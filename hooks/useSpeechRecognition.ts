import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Blob, Modality } from "@google/genai";

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

export const useSpeechRecognition = (
  onTranscriptChunk: (chunk: string) => void,
  onInterimTranscriptChange: (transcript: string) => void
) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSupported = true;

  const sessionRef = useRef<ReturnType<Awaited<ReturnType<typeof GoogleGenAI.prototype.live.connect>>> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const stopListening = useCallback(() => {
    if (!isListening) return;

    setIsListening(false);
    
    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;

    mediaStreamSourceRef.current?.disconnect();
    mediaStreamSourceRef.current = null;
    
    audioContextRef.current?.close().catch(console.error);
    audioContextRef.current = null;
    
    sessionRef.current?.close();
    sessionRef.current = null;
    
    onInterimTranscriptChange('');
  }, [isListening, onInterimTranscriptChange]);

  const startListening = useCallback(async (stream: MediaStream) => {
    if (isListening) return;
    
    if (!process.env.API_KEY) {
        const err = new Error("API_KEY environment variable not set. Please select an API key.");
        console.error("Failed to start listening:", err);
        setError(`Could not start transcription service: ${err.message}`);
        return; // Early exit
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    setError(null);
    setIsListening(true);
    let currentTurnTranscription = '';

    try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = context;

        // FIX: Use the session promise to avoid race conditions and stale closures, as per Gemini API guidelines.
        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
            },
            callbacks: {
                onopen: () => {
                    console.debug("Gemini Live session opened.");
                    const source = context.createMediaStreamSource(stream);
                    mediaStreamSourceRef.current = source;
                    const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        
                        sessionPromise.then((session) => {
                          session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(context.destination);
                },
                onmessage: (message) => {
                    if (message.serverContent?.inputTranscription) {
                        const newTextPart = message.serverContent.inputTranscription.text;
                        const isTurnComplete = message.serverContent.turnComplete;

                        currentTurnTranscription += newTextPart;
                        onInterimTranscriptChange(currentTurnTranscription);

                        if (isTurnComplete) {
                            if (currentTurnTranscription.trim()) {
                                onTranscriptChunk(currentTurnTranscription.trim() + ' ');
                            }
                            currentTurnTranscription = '';
                            setTimeout(() => onInterimTranscriptChange(''), 100); 
                        }
                    }
                },
                onerror: (e) => {
                    console.error('Gemini Live session error:', e);
                    setError('A transcription error occurred. The connection was closed.');
                    stopListening();
                },
                onclose: () => {
                    console.debug('Gemini Live session closed.');
                },
            },
        });
        sessionRef.current = await sessionPromise;
    
    } catch (err: any) {
        console.error("Failed to start listening:", err);
        setError(`Could not start transcription service: ${err.message}`);
        stopListening();
    }
  }, [isListening, onTranscriptChunk, onInterimTranscriptChange, stopListening]);

  return { isListening, isSupported, startListening, stopListening, error };
};
