import React, { useState, useEffect, ReactNode } from 'react';
import { AreaChart, Area, CartesianGrid, Legend, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Session, QuizQuestion } from '../types';
import { SaveIcon, CloseIcon, DownloadIcon, LightBulbIcon, LoadingSpinner } from './icons';
import { geminiService } from '../services/geminiService';
import Quiz from './Quiz';

interface SessionSummaryProps {
  data: Session;
  onSave: (session: Session) => void;
  onDiscard: () => void;
  isSaved: boolean;
}

const SessionSummary: React.FC<SessionSummaryProps> = ({ data, onSave, onDiscard, isSaved }) => {
  const [enlargedView, setEnlargedView] = useState<string | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[] | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEnlargedView(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleExport = () => {
    const printWindow = window.open('', '_blank', 'height=800,width=800');
    if (printWindow) {
      const pageStyle = document.querySelector('style')?.innerHTML ?? '';

      printWindow.document.write('<html><head><title>AI Session Summary</title>');
      printWindow.document.write('<style>');
      printWindow.document.write(pageStyle);
      // Add print-specific overrides
      printWindow.document.write(`
        body {
          background: #fff !important;
          color: #000 !important;
          padding: 1.5rem;
        }
        .summary-content h1, .summary-content h2, .summary-content h3, .summary-content p, .summary-content li, .summary-content strong, .summary-content .subtitle {
          color: #000 !important;
        }
        .summary-content blockquote {
          background-color: #f1f5f9 !important; /* slate-100 */
          border-color: #94a3b8 !important; /* slate-400 */
        }
        .summary-content blockquote.remember h2 {
          border-bottom: none;
        }
        .summary-content li::marker {
          color: #000 !important;
        }
        .summary-content em {
          background-color: #e2e8f0 !important; /* slate-200 */
          border: 1px solid #cbd5e1; /* slate-300 */
        }
      `);
      printWindow.document.write('</style></head><body>');
      printWindow.document.write('<div class="summary-content">');
      printWindow.document.write(data.summary);
      printWindow.document.write('</div>');
      printWindow.document.write('</body></html>');
      
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250); // A small delay is often needed for styles to apply
    }
  };

  const handleGenerateQuiz = async () => {
    setIsGeneratingQuiz(true);
    setQuizQuestions(null);
    try {
      const questions = await geminiService.generateQuiz(data.summary);
      if (questions && questions.length > 0) {
        setQuizQuestions(questions);
        setShowQuiz(true);
      } else {
        alert("Could not generate a quiz for this session. The content might be too short.");
      }
    } catch (error) {
      console.error("Failed to generate quiz", error);
      alert("An error occurred while generating the quiz. Please try again.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  };


  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTranscriptForTimestamp = (timestamp: number) => {
    const timeDiffSeconds = (timestamp - data.startTime) / 1000;
    const approximateChars = timeDiffSeconds * 2.5; // Rough estimate: 2.5 chars/sec
    const startIndex = Math.max(0, Math.floor(approximateChars - 150));
    const endIndex = Math.min(data.fullTranscript.length, Math.floor(approximateChars + 150));
    return `...${data.fullTranscript.substring(startIndex, endIndex)}...`;
  }

  const duration = data.endTime ? ((data.endTime - data.startTime) / 60000).toFixed(1) : 0;

  const renderFocusChart = (isEnlarged = false) => (
    <ResponsiveContainer width="100%" height={isEnlarged ? 600 : 300}>
      <AreaChart data={data.focusHistory} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="colorFocus" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
        <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} stroke="#a0aec0" />
        <YAxis domain={[0, 100]} stroke="#a0aec0" />
        <Tooltip
          contentStyle={{ backgroundColor: '#1a202c', border: '1px solid #4a5568' }}
          labelFormatter={(label) => formatTimestamp(label as number)}
        />
        <Legend />
        <Area type="monotone" dataKey="score" name="Focus Score" stroke="#22d3ee" fillOpacity={1} fill="url(#colorFocus)" />
          {data.lowFocusTimestamps.map((ts, index) => (
              <ReferenceArea
                  key={index}
                  x1={ts-10000}
                  x2={ts+10000}
                  stroke="red"
                  strokeOpacity={0.3}
                  fill="red"
                  fillOpacity={0.1}
              />
          ))}
      </AreaChart>
    </ResponsiveContainer>
  );

  const renderKeyMoments = () => (
    data.lowFocusTimestamps.length > 0 ? (
      <ul className="space-y-4">
        {data.lowFocusTimestamps.map((ts, index) => (
          <li key={index} className="border-l-4 border-yellow-500 pl-4">
            <p className="font-bold text-yellow-400">Attention dip at {formatTimestamp(ts)}</p>
            <p className="text-sm text-gray-400 italic mt-1 bg-gray-800 p-2 rounded">{getTranscriptForTimestamp(ts)}</p>
          </li>
        ))}
      </ul>
    ) : <p className="text-gray-400">Great job! No significant focus drops detected.</p>
  );

  const renderNotes = () => (
    <div
      className="prose prose-invert max-w-none text-gray-300 summary-content"
      dangerouslySetInnerHTML={{ __html: data.notes }}
    />
  );

  const renderSummary = () => (
     <div
      className="prose prose-invert max-w-none text-gray-300 summary-content"
      dangerouslySetInnerHTML={{ __html: data.summary }}
    />
  );

  const renderEnlargedViewModal = () => {
    if (!enlargedView) return null;

    let title: string;
    let content: ReactNode;
    let containerClassName = "flex-grow overflow-y-auto pr-4";

    switch (enlargedView) {
      case 'focus':
        title = 'Focus Over Time';
        content = renderFocusChart(true);
        break;
      case 'moments':
        title = 'Review Key Moments';
        content = renderKeyMoments();
        break;
      case 'notes':
        title = 'Generated Notes';
        content = renderNotes();
        break;
      case 'summary':
        title = 'AI Summary';
        content = renderSummary();
        break;
      default:
        return null;
    }

    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
        onClick={() => setEnlargedView(null)}
      >
        <div 
          className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col p-6 animate-modal-enter"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h2 className="text-2xl font-bold text-cyan-400">{title}</h2>
            <button onClick={() => setEnlargedView(null)} className="text-gray-400 hover:text-white p-2 rounded-full">
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>
          <div className={containerClassName}>
            {content}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <>
    {renderEnlargedViewModal()}
    {showQuiz && quizQuestions && <Quiz questions={quizQuestions} onClose={() => setShowQuiz(false)} />}

    <div className="w-full max-w-6xl mx-auto bg-gray-800 shadow-2xl rounded-lg p-8 animate-fade-in">
        <div className="p-4">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-4xl font-bold text-cyan-400">Session Summary</h1>
              <p className="text-lg text-gray-300">Class: {data.className} | Subject: {data.subject}</p>
              <p className="text-md text-gray-400">Duration: {duration} minutes</p>
            </div>
            <div>
              {isSaved ? (
                <button onClick={onDiscard} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                  Close
                </button>
              ) : (
                <button onClick={() => onSave(data)} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg transition duration-300 flex items-center justify-center">
                  <SaveIcon className="w-5 h-5 mr-2"/> Save Session
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Focus Chart */}
            <div 
              onClick={() => setEnlargedView('focus')} 
              className="bg-gray-900 p-4 rounded-lg cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:ring-2 hover:ring-cyan-500"
            >
              <h2 className="text-xl font-semibold mb-4 text-cyan-400">Focus Over Time</h2>
              {renderFocusChart()}
            </div>

            {/* Low Focus Moments */}
            <div 
              onClick={() => setEnlargedView('moments')}
              className="bg-gray-900 p-4 rounded-lg overflow-y-auto max-h-80 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:ring-2 hover:ring-cyan-500"
            >
              <h2 className="text-xl font-semibold mb-4 text-cyan-400">Review Key Moments</h2>
              {renderKeyMoments()}
            </div>
          </div>
          
          {/* Notes and Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div 
              onClick={() => setEnlargedView('notes')}
              className="bg-gray-900 p-4 rounded-lg cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:ring-2 hover:ring-cyan-500"
            >
                <h2 className="text-xl font-semibold mb-4 text-cyan-400">Generated Notes</h2>
                <div className="max-h-96 overflow-y-auto pr-2">
                    {renderNotes()}
                </div>
            </div>
            <div 
              onClick={() => setEnlargedView('summary')}
              className="bg-gray-900 p-4 rounded-lg cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:ring-2 hover:ring-cyan-500"
            >
                <h2 className="text-xl font-semibold mb-4 text-cyan-400">AI Summary</h2>
                <div className="max-h-96 overflow-y-auto pr-2">
                    {renderSummary()}
                </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row justify-end gap-4">
          <button 
                onClick={handleGenerateQuiz} 
                disabled={isGeneratingQuiz}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300 flex items-center justify-center disabled:bg-amber-700 disabled:cursor-not-allowed"
            >
                {isGeneratingQuiz ? (
                    <>
                        <LoadingSpinner className="w-5 h-5 mr-2"/> Generating...
                    </>
                ) : (
                    <>
                        <LightBulbIcon className="w-5 h-5 mr-2"/> Generate Quiz
                    </>
                )}
            </button>
          <button onClick={handleExport} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg transition duration-300 flex items-center justify-center">
            <DownloadIcon className="w-5 h-5 mr-2"/> Export to PDF
          </button>
          {!isSaved && (
              <button onClick={onDiscard} className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-2 px-4 rounded-lg transition duration-300">
                Discard
              </button>
          )}
        </div>
    </div>
    </>
  );
};

export default SessionSummary;