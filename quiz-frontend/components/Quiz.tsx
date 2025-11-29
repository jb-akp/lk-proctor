'use client';

import { useState, useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';

const QUIZ_QUESTIONS = [
  {
    question: 'What is the capital of France?',
    options: ['London', 'Berlin', 'Paris', 'Madrid'],
    correctAnswer: 'Paris',
  },
  {
    question: 'How many continents are there?',
    options: ['5', '6', '7', '8'],
    correctAnswer: '7',
  },
  {
    question: 'What is the largest planet in our solar system?',
    options: ['Saturn', 'Jupiter', 'Neptune', 'Earth'],
    correctAnswer: 'Jupiter',
  },
  {
    question: 'In what year did World War II end?',
    options: ['1943', '1944', '1945', '1946'],
    correctAnswer: '1945',
  },
];

export function Quiz() {
  const room = useRoomContext();
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);

  const startQuiz = () => {
    setQuizStarted(true);
    setCurrentQuestion(0);
    setScore(0);
    setSelectedAnswer(null);
    setQuizComplete(false);
  };

  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswer) return; // Already answered
    setSelectedAnswer(answer);
  };

  const handleNextQuestion = () => {
    const question = QUIZ_QUESTIONS[currentQuestion];
    if (selectedAnswer === question.correctAnswer) {
      setScore(score + 1);
    }

    if (currentQuestion + 1 >= QUIZ_QUESTIONS.length) {
      finishQuiz();
    } else {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    }
  };

  const finishQuiz = async () => {
    const question = QUIZ_QUESTIONS[currentQuestion];
    const finalScore = selectedAnswer === question.correctAnswer ? score + 1 : score;
    setScore(finalScore);
    setQuizComplete(true);

    // Send score to agent via RPC
    if (room) {
      try {
        const remoteParticipants = Array.from(room.remoteParticipants.values());
        const agentParticipant = remoteParticipants.find(p => p.isAgent);
        if (agentParticipant) {
          await room.localParticipant.performRpc({
            destinationIdentity: agentParticipant.identity,
            method: 'backend.quizScore',
            payload: JSON.stringify({
              score: `${finalScore} out of ${QUIZ_QUESTIONS.length}`,
            }),
          });
        }
      } catch (error) {
        console.error('Failed to send score to agent:', error);
      }
    }
  };

  if (!quizStarted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8 text-gray-900">Trivia Quiz</h1>
          <p className="text-lg text-gray-600 mb-8">Ready to test your knowledge?</p>
          <button
            onClick={startQuiz}
            className="px-8 py-4 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Start Quiz
          </button>
        </div>
      </div>
    );
  }

  if (quizComplete) {
    const percentage = Math.round((score / QUIZ_QUESTIONS.length) * 100);
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h2 className="text-3xl font-bold mb-4 text-gray-900">Quiz Complete!</h2>
          <div className="text-6xl font-bold mb-4 text-blue-600">
            {score}/{QUIZ_QUESTIONS.length}
          </div>
          <div className="text-2xl font-semibold mb-6 text-gray-700">{percentage}%</div>
          <button
            onClick={() => window.close()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Close Tab
          </button>
        </div>
      </div>
    );
  }

  const question = QUIZ_QUESTIONS[currentQuestion];
  const isCorrect = selectedAnswer === question.correctAnswer;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <div className="mb-6">
          <div className="text-sm text-gray-500 mb-2">
            Question {currentQuestion + 1} of {QUIZ_QUESTIONS.length}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${((currentQuestion + 1) / QUIZ_QUESTIONS.length) * 100}%` }}
            />
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-gray-900">{question.question}</h2>

        <div className="space-y-3 mb-6">
          {question.options.map((option, index) => {
            let buttonClass = 'w-full text-left px-6 py-4 rounded-lg border-2 transition-all font-medium ';
            
            if (selectedAnswer) {
              if (option === question.correctAnswer) {
                buttonClass += 'bg-green-100 border-green-500 text-green-800';
              } else if (option === selectedAnswer && option !== question.correctAnswer) {
                buttonClass += 'bg-red-100 border-red-500 text-red-800';
              } else {
                buttonClass += 'bg-gray-50 border-gray-300 text-gray-600';
              }
            } else {
              buttonClass += 'bg-white border-gray-300 text-gray-900 hover:border-blue-500 hover:bg-blue-50 cursor-pointer';
            }

            return (
              <button
                key={index}
                onClick={() => handleAnswerSelect(option)}
                disabled={!!selectedAnswer}
                className={buttonClass}
              >
                {option}
              </button>
            );
          })}
        </div>

        {selectedAnswer && (
          <div className="mt-6">
            <div className={`p-4 rounded-lg mb-4 ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              <p className="font-semibold">{isCorrect ? '✓ Correct!' : '✗ Incorrect'}</p>
            </div>
            <button
              onClick={handleNextQuestion}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              {currentQuestion + 1 >= QUIZ_QUESTIONS.length ? 'Finish Quiz' : 'Next Question'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
