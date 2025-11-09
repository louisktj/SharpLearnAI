import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FocusDataPoint } from '../types';
import { CameraIcon, FocusIcon, LoadingSpinner } from './icons';
import { geminiService } from '../services/geminiService';

interface FocusTrackerProps {
  stream: MediaStream | null;
  onFocusUpdate: React.Dispatch<React.SetStateAction<FocusDataPoint[]>>;
  onLowFocus: (timestamp: number, score: number) => void;
  className: string;
  onApiError: (error: any) => void;
}

const FocusTracker: React.FC<FocusTrackerProps> = ({ stream, onFocusUpdate, onLowFocus, className, onApiError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [focusScore, setFocusScore] = useState(100);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const lowFocusCounter = useRef(0);
  const teacherAlertSent = useRef(false); // To prevent sending multiple alerts
  const analysisIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const analyzeFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) {
      return;
    }
    setStatus('analyzing');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    
    try {
        const result = await geminiService.analyzeFocus(imageData);
        
        setStatus('idle');
        setErrorMessage('');
        setFocusScore(result.score);
        
        const dataPoint: FocusDataPoint = { timestamp: Date.now(), score: result.score };
        onFocusUpdate((prevHistory) => [...prevHistory, dataPoint]);

        if (result.score < 60) {
        lowFocusCounter.current += 1;
        if (lowFocusCounter.current === 1) {
            onLowFocus(dataPoint.timestamp, result.score);
        }
        
        if (result.score === 0 && !teacherAlertSent.current) {
            teacherAlertSent.current = true;
            geminiService.sendFocusAlertToTeacher(className);
        }

        } else {
        lowFocusCounter.current = 0;
        teacherAlertSent.current = false;
        }

    } catch (err) {
        onApiError(err);
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setFocusScore(0);
    }
  }, [onFocusUpdate, onLowFocus, className, onApiError]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
      setTimeout(() => {
        analysisIntervalRef.current = setInterval(analyzeFrame, 2000);
      }, 1000);
    }

    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, [stream, analyzeFrame]);

  const getFocusColor = () => {
    if (status === 'error') return 'text-red-500';
    if (focusScore > 80) return 'text-green-400';
    if (focusScore > 50) return 'text-yellow-400';
    return 'text-red-500';
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <h2 className="text-lg font-semibold text-cyan-400 mb-2 flex items-center gap-2">
        <FocusIcon className="w-5 h-5"/> 
        Focus Score
        {status === 'analyzing' && <LoadingSpinner className="w-4 h-4 text-cyan-400"/>}
      </h2>
      <div className="flex items-center justify-between">
        <div className={`text-5xl font-bold ${getFocusColor()}`}>{Math.round(focusScore)}%</div>
        <div className="w-24 h-20 bg-gray-900 rounded-md overflow-hidden border-2 border-gray-700">
          {stream ? (
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]"></video>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <CameraIcon className="w-8 h-8 text-gray-500"/>
            </div>
          )}
        </div>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2.5 mt-3">
        <div className="bg-cyan-500 h-2.5 rounded-full" style={{ width: `${focusScore}%`, transition: 'width 0.5s ease-in-out' }}></div>
      </div>
      {status === 'error' && (
        <p className="text-xs text-red-400 mt-2 truncate" title={errorMessage}>
          Analysis Error: {errorMessage.split('apiKey=')[0]}
        </p>
      )}
      <canvas ref={canvasRef} className="hidden"></canvas>
    </div>
  );
};

export default FocusTracker;
