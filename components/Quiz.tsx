import React, { useState } from 'react';
import { QuizQuestion } from '../types';
import { CheckIcon, CloseIcon } from './icons';

interface QuizProps {
  questions: QuizQuestion[];
  onClose: () => void;
}

const Quiz: React.FC<QuizProps> = ({ questions, onClose }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const isAnswered = selectedAnswer !== null;
  const isCorrect = isAnswered && selectedAnswer === currentQuestion.correctAnswer;

  const handleAnswerSelect = (option: string) => {
    if (isAnswered) return;
    setSelectedAnswer(option);
    if (option === currentQuestion.correctAnswer) {
      setScore(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
    } else {
      setShowResults(true);
    }
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setScore(0);
    setShowResults(false);
  };
  
  const getButtonClass = (option: string) => {
    if (!isAnswered) {
      return 'bg-gray-700 hover:bg-gray-600';
    }
    if (option === currentQuestion.correctAnswer) {
      return 'bg-green-500/80 ring-2 ring-green-400';
    }
    if (option === selectedAnswer) {
      return 'bg-red-500/80 ring-2 ring-red-400';
    }
    return 'bg-gray-700 opacity-60';
  };

  if (showResults) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col p-8 animate-modal-enter text-center" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-3xl font-bold text-cyan-400 mb-4">Quiz Complete!</h2>
                <p className="text-xl text-gray-300 mb-6">You scored</p>
                <p className="text-6xl font-bold text-cyan-300 mb-8">{score} / {questions.length}</p>
                <div className="flex justify-center gap-4">
                    <button onClick={handleRestart} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-6 rounded-lg transition duration-300">
                        Try Again
                    </button>
                    <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-2 px-6 rounded-lg transition duration-300">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col p-6 animate-modal-enter" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-cyan-400">Knowledge Check</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-full">
                    <CloseIcon className="w-6 h-6" />
                </button>
            </div>
            
            <div className="w-full bg-gray-700 rounded-full h-2.5 mb-6">
                <div className="bg-cyan-500 h-2.5 rounded-full" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`, transition: 'width 0.5s ease-in-out' }}></div>
            </div>
            
            <div className="flex-grow overflow-y-auto pr-4">
                <p className="text-gray-400 mb-2 font-semibold">Question {currentQuestionIndex + 1} of {questions.length}</p>
                <h3 className="text-2xl font-semibold text-white mb-6">{currentQuestion.question}</h3>
                
                <div className="space-y-4">
                    {currentQuestion.options.map((option, index) => (
                        <button
                            key={index}
                            onClick={() => handleAnswerSelect(option)}
                            disabled={isAnswered}
                            className={`w-full text-left p-4 rounded-lg text-lg transition-all duration-300 ${getButtonClass(option)} ${!isAnswered ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                            {option}
                        </button>
                    ))}
                </div>

                {isAnswered && (
                    <div className={`mt-6 p-4 rounded-lg animate-modal-enter ${isCorrect ? 'bg-green-900/50 border border-green-700' : 'bg-red-900/50 border border-red-700'}`}>
                        <h4 className={`text-xl font-bold ${isCorrect ? 'text-green-300' : 'text-red-300'}`}>{isCorrect ? 'Correct!' : 'Incorrect'}</h4>
                        <p className="text-gray-300 mt-2">{currentQuestion.explanation}</p>
                    </div>
                )}
            </div>

            <div className="mt-6 flex-shrink-0">
                {isAnswered && (
                    <button 
                        onClick={handleNextQuestion}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition duration-300 text-lg"
                    >
                        {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};

export default Quiz;
