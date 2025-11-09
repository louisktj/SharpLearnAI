import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, Session, FocusDataPoint, RegisteredClass } from './types';
import { geminiService } from './services/geminiService';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import FocusTracker from './components/FocusTracker';
import SessionSummary from './components/SessionSummary';
import { AlertIcon, ChevronRightIcon, CollectionIcon, LoadingSpinner, MicIcon, TrashIcon } from './components/icons';

// FIX: Resolved global type conflicts for `window.aistudio`.
// The previous inline type and `readonly` modifier conflicted with another
// global declaration. This change defines a mergeable `AIStudio` interface
// and applies it to `window.aistudio` to ensure type consistency across the app.
declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
    interface Window {
        // FIX: All declarations of 'aistudio' must have identical modifiers. Made property optional to align with other declarations.
        aistudio?: AIStudio;
    }
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.SETUP);
  const [sessionData, setSessionData] = useState<Partial<Session>>({});
  
  const [registeredClasses, setRegisteredClasses] = useState<RegisteredClass[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [viewingClassId, setViewingClassId] = useState<string | null>(null);
  const [isViewingSavedSummary, setIsViewingSavedSummary] = useState(false);

  const [subject, setSubject] = useState('');
  const [isSubjectLoading, setIsSubjectLoading] = useState(false);
  const [fullTranscript, setFullTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [focusHistory, setFocusHistory] = useState<FocusDataPoint[]>([]);
  const [lowFocusTimestamps, setLowFocusTimestamps] = useState<number[]>([]);
  const [focusAlert, setFocusAlert] = useState<{ show: boolean, message: string, title: string }>({ show: false, message: '', title: '' });

  const [isApiKeySelected, setIsApiKeySelected] = useState<boolean | null>(null);

  const subjectDetectionTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  
  const sessionStateRef = useRef({
    fullTranscript: '',
    interimTranscript: '',
    subject: '',
    focusHistory: [] as FocusDataPoint[],
    lowFocusTimestamps: [] as number[],
  });

  useEffect(() => {
    sessionStateRef.current = {
      fullTranscript,
      interimTranscript,
      subject,
      focusHistory,
      lowFocusTimestamps,
    };
  }, [fullTranscript, interimTranscript, subject, focusHistory, lowFocusTimestamps]);
  
  const checkApiKey = useCallback(async () => {
    try {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsApiKeySelected(hasKey);
      } else {
        // Fallback for environments where aistudio is not available
        setIsApiKeySelected(true); 
      }
    } catch (e) {
      console.error("Error checking for API key:", e);
      setIsApiKeySelected(false); // Assume no key if check fails
    }
  }, []);

  useEffect(() => {
    checkApiKey();
  }, [checkApiKey]);
  
  const handleSelectKey = async () => {
    try {
      await window.aistudio.openSelectKey();
      // Optimistically assume key is selected to avoid race condition and re-check
      checkApiKey();
    } catch (e) {
      console.error("Error opening select key dialog:", e);
    }
  };

  const handleApiError = useCallback((error: any) => {
    const errorMessage = error?.message || '';
    if (errorMessage.includes('Requested entity was not found') || errorMessage.includes('API key not valid')) {
      alert("The selected API key appears to be invalid. Please select another key to continue.");
      setIsApiKeySelected(false);
      // If a session is active, stop it.
      if(appState === AppState.ACTIVE) {
        stopListening();
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        setAppState(AppState.SETUP);
      }
    }
  }, [appState]);


  useEffect(() => {
    try {
      const savedClasses = localStorage.getItem('sharplearn-classes');
      if (savedClasses) {
        const parsedClasses: RegisteredClass[] = JSON.parse(savedClasses);
        parsedClasses.forEach(c => c.sessions = c.sessions || []);
        setRegisteredClasses(parsedClasses);
      }
    } catch (error) {
      console.error("Failed to load classes from local storage", error);
    }
  }, []);
  
  const handleTranscriptChunk = useCallback((chunk: string) => {
    setFullTranscript(prev => prev + chunk);
  }, []);

  const { isListening, isSupported, startListening, stopListening, error } = useSpeechRecognition(handleTranscriptChunk, setInterimTranscript);

  useEffect(() => {
    if (error) {
      handleApiError({ message: error });
    }
  }, [error, handleApiError]);


  const processTranscriptPeriodically = useCallback(async () => {
    if (!sessionStateRef.current.subject && !isSubjectLoading && sessionStateRef.current.fullTranscript.length > 200) {
      setIsSubjectLoading(true);
      try {
        const identifiedSubject = await geminiService.identifySubject(sessionStateRef.current.fullTranscript);
        setSubject(identifiedSubject);
      } catch (err) {
        console.error("Error identifying subject:", err);
        handleApiError(err);
      } finally {
        setIsSubjectLoading(false);
      }
    }
  }, [isSubjectLoading, handleApiError]);


  useEffect(() => {
    if (isListening) {
      if (subjectDetectionTimer.current) clearInterval(subjectDetectionTimer.current);
      subjectDetectionTimer.current = setInterval(processTranscriptPeriodically, 10000);
    } else {
      if (subjectDetectionTimer.current) {
        clearInterval(subjectDetectionTimer.current);
        subjectDetectionTimer.current = null;
      }
    }
    return () => {
      if (subjectDetectionTimer.current) clearInterval(subjectDetectionTimer.current);
    }
  }, [isListening, processTranscriptPeriodically]);


  const startSession = async (cls: RegisteredClass) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      
      setAppState(AppState.ACTIVE);
      setIsViewingSavedSummary(false);
      setSubject('');
      setSessionData({
        id: Date.now().toString(),
        className: cls.name,
        subject: '',
        startTime: Date.now(),
      });
      setFocusHistory([]);
      setLowFocusTimestamps([]);
      setFullTranscript('');
      setInterimTranscript('');
      await startListening(stream);
    } catch (err: any) {
      alert(`Could not start session. Please ensure camera and microphone access are allowed. Error: ${err.message}`);
    }
  };
  
  const startQuickSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      
      setAppState(AppState.ACTIVE);
      setIsViewingSavedSummary(false);
      setSubject('');
      setSessionData({
        id: Date.now().toString(),
        className: 'Quick Record',
        subject: '',
        startTime: Date.now(),
      });
      setFocusHistory([]);
      setLowFocusTimestamps([]);
      setFullTranscript('');
      setInterimTranscript('');
      await startListening(stream);
    } catch (err: any) {
      alert(`Could not start session. Please ensure camera and microphone access are allowed. Error: ${err.message}`);
    }
  };

  const endSession = useCallback(async () => {
    stopListening();
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }

    setAppState(AppState.LOADING);
    
    const { 
      fullTranscript: finalTranscriptChunks, 
      interimTranscript: lastInterimChunk,
      subject: finalSubject, 
      focusHistory: finalFocusHistory,
      lowFocusTimestamps: finalLowFocusTimestamps
    } = sessionStateRef.current;
    
    const finalTranscript = (finalTranscriptChunks + ' ' + lastInterimChunk).trim();

    let finalSessionData: Partial<Session> = {
        ...sessionData,
        endTime: Date.now(),
        focusHistory: finalFocusHistory,
        lowFocusTimestamps: finalLowFocusTimestamps,
        fullTranscript: finalTranscript,
        subject: finalSubject || "Not detected"
    };

    try {
      if (sessionData.className === 'Quick Record' && finalTranscript.trim().length > 50) {
          const generatedClassName = await geminiService.generateClassNameFromTranscript(finalTranscript);
          finalSessionData.className = generatedClassName;

          if (!finalSubject || finalSubject === "Unknown" || finalSubject === "Not detected") {
               finalSessionData.subject = await geminiService.identifySubject(finalTranscript);
          }
      }
      
      const finalNotes = await geminiService.structureNotes(finalTranscript);
      const finalSummary = await geminiService.generateFinalSummary(finalTranscript, finalSessionData.subject!);
      
      setSessionData({
        ...finalSessionData,
        notes: finalNotes,
        summary: finalSummary,
      });
      setAppState(AppState.SUMMARY);

    } catch(err) {
      handleApiError(err);
      setAppState(AppState.SETUP); // Go back to setup on error
    }
  }, [stopListening, sessionData, handleApiError]);
  
  const handleLowFocus = useCallback((timestamp: number, score: number) => {
      let title = "Losing focus?";
      let message = "Take a moment. You can review this part later.";
      if(score === 0) {
        title = "Are you there?";
        message = "You seem to be out of the camera frame."
      }
      setFocusAlert({ show: true, title, message });
      setLowFocusTimestamps(prev => [...prev, timestamp]);
      setTimeout(() => setFocusAlert({ show: false, message: '', title: '' }), 5000);
  }, []);

  const handleAddClass = () => {
    if (!newClassName.trim()) {
      alert("Please provide a name for the class.");
      return;
    }
    const newClass: RegisteredClass = {
      id: Date.now().toString(),
      name: newClassName.trim(),
      sessions: [],
    };
    const updatedClasses = [...registeredClasses, newClass];
    setRegisteredClasses(updatedClasses);
    localStorage.setItem('sharplearn-classes', JSON.stringify(updatedClasses));
    setNewClassName('');
  };

  const handleDeleteClass = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewingClassId === id) {
        setViewingClassId(null);
    }
    const updatedClasses = registeredClasses.filter(c => c.id !== id);
    setRegisteredClasses(updatedClasses);
    localStorage.setItem('sharplearn-classes', JSON.stringify(updatedClasses));
  };
  
  const handleSaveSession = (sessionToSave: Session) => {
    const targetClassName = sessionToSave.className;
  
    if (!targetClassName) {
      console.error("Session has no class name, cannot save.");
      alert("Cannot save session: Class name is missing.");
      setAppState(AppState.SETUP);
      return;
    }
  
    let updatedClasses;
    const targetClass = registeredClasses.find(
      (c) => c.name.toLowerCase() === targetClassName.toLowerCase()
    );
  
    if (targetClass) {
      updatedClasses = registeredClasses.map((cls) => {
        if (cls.id === targetClass.id) {
          return { ...cls, sessions: [...cls.sessions, { ...sessionToSave, className: cls.name }] };
        }
        return cls;
      });
    } else {
      const newClass: RegisteredClass = {
        id: Date.now().toString(),
        name: targetClassName,
        sessions: [{ ...sessionToSave, className: targetClassName }],
      };
      updatedClasses = [...registeredClasses, newClass];
    }
  
    setRegisteredClasses(updatedClasses);
    localStorage.setItem('sharplearn-classes', JSON.stringify(updatedClasses));
    setAppState(AppState.SETUP);
    setViewingClassId(null);
  };

  const handleDiscardSession = () => {
    setAppState(AppState.SETUP);
    setViewingClassId(null);
  };

  const viewSavedSession = (session: Session) => {
    setSessionData(session);
    setIsViewingSavedSummary(true);
    setAppState(AppState.SUMMARY);
  };
  
  const renderSetupScreen = () => {
    const viewedClass = registeredClasses.find(c => c.id === viewingClassId);
    
    return (
      <div className="w-full max-w-7xl mx-auto h-[90vh] p-4 md:p-8 flex flex-col md:flex-row gap-8">
        {/* Left Sidebar */}
        <aside className="w-full md:w-1/3 bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-6 rounded-lg shadow-2xl flex flex-col">
          <h2 className="text-2xl font-semibold text-white mb-4">My Classes</h2>
          <div className="flex-grow overflow-y-auto mb-4">
            {registeredClasses.length > 0 ? registeredClasses.map(cls => (
              <div
                key={cls.id}
                onClick={() => setViewingClassId(cls.id)}
                className={`
                  flex items-center justify-between p-4 rounded-lg border 
                  cursor-pointer transition-all duration-300 ease-in-out transform 
                  hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-500/20
                  my-2 mr-3 group 
                  ${viewingClassId === cls.id 
                    ? 'bg-gray-700/60 border-cyan-500 ring-2 ring-cyan-500 ring-offset-2 ring-offset-gray-800'
                    : 'bg-gradient-to-br from-gray-800 to-gray-900/50 border-gray-700 hover:border-cyan-600'
                  }`
                }
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg text-cyan-400 group-hover:text-cyan-300 transition-colors">{cls.name}</p>
                </div>
                <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                  <div className="flex items-center gap-2 bg-black/20 border border-gray-700 group-hover:border-gray-600 rounded-full px-3 py-1 text-sm transition-colors">
                    <CollectionIcon className="w-4 h-4 text-cyan-600 group-hover:text-cyan-500 transition-colors" />
                    <span className="font-semibold text-gray-200">
                      {cls.sessions.length}
                    </span>
                    <span className="text-gray-400 hidden sm:inline">
                      {cls.sessions.length === 1 ? 'Session' : 'Sessions'}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteClass(cls.id, e)}
                    className="text-gray-500 hover:text-red-400 p-2 rounded-full transition-all duration-200 hover:scale-110"
                    aria-label={`Delete ${cls.name}`}
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )) : (
              <p className="text-gray-400 text-center py-4">No classes added yet. Add one below to get started!</p>
            )}
          </div>

          <div className="mt-auto pt-6 border-t border-gray-700">
            <h3 className="text-xl font-semibold text-white mb-3">Add a New Class</h3>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="e.g., Biology 101"
                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                onClick={handleAddClass}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
              >
                Add Class
              </button>
            </div>
          </div>
          
          {!isSupported && <p className="text-red-400 text-sm mt-4 text-center">Speech recognition is not supported in this browser.</p>}
        </aside>

        {/* Main Content */}
        <section className="w-full md:w-2/3">
          {error && (
            <div className="bg-red-900/50 border border-red-600 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
              <strong className="font-bold">Transcription Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {viewedClass ? (
            <div className="w-full h-full">
                <button onClick={() => setViewingClassId(null)} className="text-cyan-400 hover:text-cyan-300 mb-4">&larr; Back to Home</button>
                <div className="bg-gray-800 p-6 rounded-lg shadow-2xl h-[calc(100%-2rem)] flex flex-col">
                    <h2 className="text-2xl font-bold text-white">{viewedClass.name}</h2>
                    
                    <button
                      onClick={() => startSession(viewedClass)}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition duration-300 my-6"
                    >
                      Start New Session for {viewedClass.name}
                    </button>
                    
                    <h3 className="text-xl font-semibold text-white mb-4">Saved Sessions</h3>
                    <div className="space-y-3 flex-grow overflow-y-auto pr-2">
                        {viewedClass.sessions.length > 0 ? viewedClass.sessions.map(ses => (
                            <div
                              key={ses.id}
                              onClick={() => viewSavedSession(ses)}
                              className="bg-gray-700 hover:bg-gray-600 p-4 rounded-lg flex justify-between items-center cursor-pointer transition duration-200"
                            >
                                <p className="font-semibold text-gray-200">Session from {new Date(ses.startTime).toLocaleString()}</p>
                                <ChevronRightIcon className="w-5 h-5 text-gray-400"/>
                            </div>
                        )) : (
                            <p className="text-gray-400 text-center py-4">No saved sessions for this class yet.</p>
                        )}
                    </div>
                </div>
            </div>
          ) : (
            <div className="text-center flex flex-col items-center justify-center h-full">
              <img src="/Logo.png" alt="SharpLearn Logo" className="w-64 h-auto mb-6" />
              <h1 className="text-5xl font-bold text-white tracking-tight">Master Your Classes</h1>
              <p className="text-3xl font-medium mt-2 mb-10">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                      with your AI Study Companion.
                  </span>
              </p>
              
              <button
                onClick={startQuickSession}
                className="bg-red-600 hover:bg-red-500 text-white font-bold py-4 px-8 rounded-lg transition duration-300 text-lg flex items-center gap-3 shadow-lg shadow-red-500/20 hover:shadow-red-500/40"
              >
                <MicIcon className="w-6 h-6"/> Start Quick Record
              </button>
              <p className="text-gray-400 mt-4 max-w-md">
                Select a class on the left to begin, or start a quick recording session instantly.
              </p>
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderContent = () => {
    switch (appState) {
      case AppState.SETUP:
        return renderSetupScreen();
      case AppState.ACTIVE:
        return (
          <div className="w-full h-full flex flex-col md:flex-row gap-4 p-4">
            {/* Left Panel */}
            <div className="w-full md:w-1/4 flex flex-col gap-4">
              <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex-grow">
                <h2 className="text-lg font-semibold text-cyan-400 mb-2">Session Info</h2>
                <p><span className="font-bold">Class:</span> {sessionData.className}</p>
                <p><span className="font-bold">Subject:</span> {subject || <span className="text-gray-400">Detecting...</span>}</p>
              </div>
              <FocusTracker 
                stream={mediaStreamRef.current} 
                onFocusUpdate={setFocusHistory} 
                onLowFocus={handleLowFocus}
                className={sessionData.className || 'Unknown Class'}
                onApiError={handleApiError}
              />
              <button
                onClick={endSession}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-lg transition duration-300"
              >
                End Session
              </button>
            </div>
            {/* Main Content: Simplified Live Transcript View */}
            <div className="w-full md:w-3/4 bg-gray-800 p-6 rounded-lg shadow-lg overflow-y-auto">
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`}>
                    <MicIcon className="w-6 h-6 text-white"/>
                </div>
                <h2 className="text-2xl font-bold text-cyan-400">Live Session</h2>
              </div>
              
              <h3 className="text-xl font-semibold text-cyan-400 mb-2">Live Transcript</h3>
              <div className="prose prose-invert max-w-none text-gray-300 whitespace-pre-wrap mb-6 min-h-[calc(100%-4rem)]">
                {fullTranscript}
                <span className="text-gray-500 italic">{interimTranscript}</span>
              </div>

            </div>
          </div>
        );
       case AppState.LOADING:
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <LoadingSpinner className="w-16 h-16 text-cyan-400" />
                <p className="text-xl mt-4 text-gray-300">Generating session summary...</p>
            </div>
        );
      case AppState.SUMMARY:
        return <SessionSummary 
            data={sessionData as Session} 
            onSave={handleSaveSession}
            onDiscard={handleDiscardSession}
            isSaved={isViewingSavedSummary}
        />;
    }
  };

  if (isApiKeySelected === null) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900">
        <LoadingSpinner className="w-16 h-16 text-cyan-400" />
      </main>
    );
  }

  if (!isApiKeySelected) {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900">
            <div className="bg-gray-800 p-8 rounded-lg shadow-2xl text-center max-w-lg">
                <h1 className="text-3xl font-bold text-cyan-400 mb-4">API Key Required</h1>
                <p className="text-gray-300 mb-6">
                    To use SharpLearn and avoid quota limits from shared keys, please select your own Google AI API key.
                </p>
                <button
                    onClick={handleSelectKey}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition duration-300 text-lg"
                >
                    Select API Key
                </button>
                <p className="text-xs text-gray-500 mt-4">
                    For more information on billing, visit{' '}
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-cyan-400">
                        ai.google.dev/gemini-api/docs/billing
                    </a>.
                </p>
            </div>
        </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      {renderContent()}
      {focusAlert.show && (
         <div className="absolute top-5 right-5 bg-yellow-500/20 backdrop-blur-md text-white border border-yellow-400 rounded-lg p-4 flex items-center gap-3 animate-fade-in-out">
            <AlertIcon className="w-8 h-8 text-yellow-300"/>
            <div>
                <p className="font-bold">{focusAlert.title}</p>
                <p className="text-sm">{focusAlert.message}</p>
            </div>
        </div>
      )}
    </main>
  );
};

export default App;