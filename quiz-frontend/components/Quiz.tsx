'use client';

import { useState } from 'react';

// Add custom styles for animations
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .animate-fade-in {
    animation: fadeIn 0.5s ease-out;
  }
  .animate-slide-in {
    animation: slideIn 0.4s ease-out;
  }
  .animate-scale-in {
    animation: scaleIn 0.3s ease-out;
  }
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  if (!document.head.querySelector('style[data-quiz-animations]')) {
    styleSheet.setAttribute('data-quiz-animations', 'true');
    document.head.appendChild(styleSheet);
  }
}

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

  const finishQuiz = () => {
    const question = QUIZ_QUESTIONS[currentQuestion];
    const finalScore = selectedAnswer === question.correctAnswer ? score + 1 : score;
    setScore(finalScore);
    setQuizComplete(true);
    // Agent will detect quiz completion from screen share and announce the score
  };

  if (!quizStarted) {
    return (
      <div 
        className="flex items-center justify-center min-h-screen relative overflow-hidden"
        style={{
          background: 'linear-gradient(to bottom right, #f8fafc, #eff6ff, #eef2ff)',
        }}
      >
        {/* Enhanced decorative background elements */}
        <div 
          className="absolute rounded-full mix-blend-multiply opacity-30"
          style={{
            top: 0,
            left: 0,
            width: '384px',
            height: '384px',
            background: '#93c5fd',
            filter: 'blur(80px)',
            animation: 'pulse 3s ease-in-out infinite',
          }}
        ></div>
        <div 
          className="absolute rounded-full mix-blend-multiply opacity-30"
          style={{
            top: 0,
            right: 0,
            width: '384px',
            height: '384px',
            background: '#c4b5fd',
            filter: 'blur(80px)',
            animation: 'pulse 3s ease-in-out infinite',
            animationDelay: '2s',
          }}
        ></div>
        <div 
          className="absolute rounded-full mix-blend-multiply opacity-30"
          style={{
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '384px',
            height: '384px',
            background: '#a5b4fc',
            filter: 'blur(80px)',
            animation: 'pulse 3s ease-in-out infinite',
            animationDelay: '4s',
          }}
        ></div>
        
        <div 
          className="text-center relative z-10"
          style={{
            background: 'white',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '40px',
            maxWidth: '500px',
            width: '100%',
            margin: '0 16px',
            border: '2px solid #e5e7eb',
          }}
        >
          <div 
            style={{
              fontSize: '128px',
              marginBottom: '32px',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            🧠
          </div>
          <h1 
            style={{
              fontSize: '72px',
              fontWeight: 900,
              marginBottom: '24px',
              background: 'linear-gradient(to right, #2563eb, #9333ea, #4f46e5)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              lineHeight: 1.2,
            }}
          >
            Trivia Quiz
          </h1>
          <p 
            style={{
              fontSize: '24px',
              color: '#374151',
              marginBottom: '48px',
              fontWeight: 600,
            }}
          >
            Ready to test your knowledge?
          </p>
          <button
            onClick={startQuiz}
            style={{
              padding: '24px 56px',
              background: 'linear-gradient(to right, #2563eb, #9333ea, #4f46e5)',
              color: 'white',
              borderRadius: '16px',
              fontSize: '24px',
              fontWeight: 900,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 25px 50px -12px rgba(37, 99, 235, 0.5)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 30px 60px -12px rgba(37, 99, 235, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(37, 99, 235, 0.5)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
            }}
          >
            Start Quiz →
          </button>
        </div>
      </div>
    );
  }

  if (quizComplete) {
    const percentage = Math.round((score / QUIZ_QUESTIONS.length) * 100);
    const isPerfect = score === QUIZ_QUESTIONS.length;
    const isGood = percentage >= 75;
    
    return (
      <div 
        className="flex items-center justify-center min-h-screen relative overflow-hidden"
        style={{
          background: 'linear-gradient(to bottom right, #f8fafc, #eff6ff, #eef2ff)',
        }}
      >
        {/* Enhanced decorative background elements */}
        <div 
          className="absolute rounded-full mix-blend-multiply opacity-30"
          style={{
            top: 0,
            left: 0,
            width: '320px',
            height: '320px',
            background: '#93c5fd',
            filter: 'blur(80px)',
            animation: 'pulse 3s ease-in-out infinite',
          }}
        ></div>
        <div 
          className="absolute rounded-full mix-blend-multiply opacity-30"
          style={{
            top: 0,
            right: 0,
            width: '320px',
            height: '320px',
            background: '#c4b5fd',
            filter: 'blur(80px)',
            animation: 'pulse 3s ease-in-out infinite',
            animationDelay: '2s',
          }}
        ></div>
        <div 
          className="absolute rounded-full mix-blend-multiply opacity-30"
          style={{
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '320px',
            height: '320px',
            background: '#a5b4fc',
            filter: 'blur(80px)',
            animation: 'pulse 3s ease-in-out infinite',
            animationDelay: '4s',
          }}
        ></div>
        
        <div 
          className="text-center relative z-10"
          style={{
            background: 'white',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '48px',
            maxWidth: '500px',
            width: '100%',
            margin: '0 16px',
            border: '2px solid #e5e7eb',
          }}
        >
          <div 
            style={{
              fontSize: '96px',
              marginBottom: '32px',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            {isPerfect ? '🎉' : isGood ? '👍' : '📚'}
          </div>
          <h2 
            style={{
              fontSize: '48px',
              fontWeight: 900,
              marginBottom: '32px',
              color: '#111827',
            }}
          >
            Quiz Complete!
          </h2>
          <div style={{ marginBottom: '32px' }}>
            <div 
              style={{
                fontSize: '64px',
                fontWeight: 900,
                marginBottom: '16px',
                color: '#111827',
              }}
            >
              {score}/{QUIZ_QUESTIONS.length}
            </div>
            <div 
              style={{
                fontSize: '48px',
                fontWeight: 700,
                background: isPerfect 
                  ? 'linear-gradient(to right, #fbbf24, #f97316, #ef4444)' 
                  : isGood 
                  ? 'linear-gradient(to right, #2563eb, #9333ea)' 
                  : 'linear-gradient(to right, #4b5563, #1f2937)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {percentage}%
            </div>
            {isPerfect && (
              <p style={{ fontSize: '20px', color: '#4b5563', marginTop: '16px', fontWeight: 600 }}>
                Perfect Score! 🎊
              </p>
            )}
            {isGood && !isPerfect && (
              <p style={{ fontSize: '20px', color: '#4b5563', marginTop: '16px', fontWeight: 600 }}>
                Great Job! 👏
              </p>
            )}
            {!isGood && (
              <p style={{ fontSize: '20px', color: '#4b5563', marginTop: '16px', fontWeight: 600 }}>
                Keep Learning! 💪
              </p>
            )}
          </div>
          <button
            onClick={() => window.close()}
            style={{
              padding: '20px 40px',
              background: 'linear-gradient(to right, #2563eb, #9333ea, #4f46e5)',
              color: 'white',
              borderRadius: '16px',
              fontSize: '20px',
              fontWeight: 900,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 25px 50px -12px rgba(37, 99, 235, 0.5)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 30px 60px -12px rgba(37, 99, 235, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(37, 99, 235, 0.5)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
            }}
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
      <div 
        className="flex items-center justify-center min-h-screen p-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(to bottom right, #f8fafc, #eff6ff, #eef2ff)',
        }}
      >
        {/* Enhanced background decoration */}
        <div 
          className="absolute rounded-full mix-blend-multiply opacity-30"
          style={{
            top: 0,
            left: 0,
            width: '320px',
            height: '320px',
            background: '#93c5fd',
            filter: 'blur(80px)',
          }}
        ></div>
        <div 
          className="absolute rounded-full mix-blend-multiply opacity-30"
          style={{
            bottom: 0,
            right: 0,
            width: '320px',
            height: '320px',
            background: '#c4b5fd',
            filter: 'blur(80px)',
          }}
        ></div>
        <div 
          className="absolute rounded-full mix-blend-multiply opacity-20"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '384px',
            height: '384px',
            background: '#a5b4fc',
            filter: 'blur(80px)',
          }}
        ></div>
        
        {/* Modal-style card */}
        <div 
          className="relative z-10"
          style={{
            background: 'white',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '32px',
            maxWidth: '480px',
            width: '100%',
            border: '2px solid #e5e7eb',
          }}
        >
          {/* Header with progress */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span 
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#1f2937',
                  background: 'linear-gradient(to right, #f3f4f6, #e5e7eb)',
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #d1d5db',
                }}
              >
                Question {currentQuestion + 1} of {QUIZ_QUESTIONS.length}
              </span>
              <span 
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#1e40af',
                  background: 'linear-gradient(to right, #dbeafe, #e0e7ff)',
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #93c5fd',
                }}
              >
                Score: {score}/{QUIZ_QUESTIONS.length}
              </span>
            </div>
            <div 
              style={{
                width: '100%',
                background: '#e5e7eb',
                borderRadius: '9999px',
                height: '20px',
                overflow: 'hidden',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
            >
              <div
                style={{
                  background: 'linear-gradient(to right, #2563eb, #9333ea, #4f46e5)',
                  height: '100%',
                  borderRadius: '9999px',
                  width: `${((currentQuestion + 1) / QUIZ_QUESTIONS.length) * 100}%`,
                  transition: 'width 0.7s ease-out',
                  boxShadow: '0 4px 6px rgba(37, 99, 235, 0.3)',
                  position: 'relative',
                }}
              >
                <div 
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(255, 255, 255, 0.3)',
                    animation: 'pulse 2s ease-in-out infinite',
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Question */}
          <h2 
            style={{
              fontSize: '32px',
              fontWeight: 900,
              marginBottom: '32px',
              color: '#111827',
              lineHeight: 1.3,
              letterSpacing: '-0.5px',
            }}
          >
            {question.question}
          </h2>

          {/* Answer options */}
          <div style={{ marginBottom: '32px' }}>
            {question.options.map((option, index) => {
              const isSelected = selectedAnswer === option;
              const isCorrect = option === question.correctAnswer;
              const isWrong = isSelected && !isCorrect;
              
              let buttonStyle: React.CSSProperties = {
                width: '100%',
                textAlign: 'left',
                padding: '16px 24px',
                borderRadius: '12px',
                border: '3px solid',
                fontSize: '16px',
                fontWeight: 700,
                marginBottom: '12px',
                cursor: selectedAnswer ? 'default' : 'pointer',
                transition: 'all 0.3s ease',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              };

              if (selectedAnswer) {
                if (isCorrect) {
                  buttonStyle.background = 'linear-gradient(to right, #dcfce7, #d1fae5)';
                  buttonStyle.borderColor = '#22c55e';
                  buttonStyle.color = '#166534';
                  buttonStyle.transform = 'scale(1.02)';
                  buttonStyle.boxShadow = '0 10px 15px rgba(34, 197, 94, 0.3)';
                } else if (isWrong) {
                  buttonStyle.background = 'linear-gradient(to right, #fee2e2, #fecaca)';
                  buttonStyle.borderColor = '#ef4444';
                  buttonStyle.color = '#991b1b';
                  buttonStyle.boxShadow = '0 8px 12px rgba(239, 68, 68, 0.3)';
                } else {
                  buttonStyle.background = '#f9fafb';
                  buttonStyle.borderColor = '#d1d5db';
                  buttonStyle.color = '#9ca3af';
                }
              } else {
                buttonStyle.background = 'white';
                buttonStyle.borderColor = '#9ca3af';
                buttonStyle.color = '#111827';
              }

              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(option)}
                  disabled={!!selectedAnswer}
                  style={buttonStyle}
                  onMouseEnter={(e) => {
                    if (!selectedAnswer) {
                      e.currentTarget.style.borderColor = '#2563eb';
                      e.currentTarget.style.background = 'linear-gradient(to right, #eff6ff, #eef2ff)';
                      e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                      e.currentTarget.style.boxShadow = '0 12px 24px rgba(37, 99, 235, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedAnswer) {
                      e.currentTarget.style.borderColor = '#9ca3af';
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                    }
                  }}
                >
                  <span 
                    style={{
                      marginRight: '16px',
                      fontSize: '18px',
                      fontWeight: 900,
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      ...(selectedAnswer && isCorrect
                        ? { background: '#22c55e', color: 'white', boxShadow: '0 2px 4px rgba(34, 197, 94, 0.3)' }
                        : selectedAnswer && isWrong
                        ? { background: '#ef4444', color: 'white', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)' }
                        : { background: 'linear-gradient(to bottom right, #e5e7eb, #d1d5db)', color: '#374151' }
                      ),
                    }}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span>{option}</span>
                  {isCorrect && selectedAnswer && (
                    <span style={{ position: 'absolute', right: '20px', fontSize: '24px', color: '#22c55e', fontWeight: 900 }}>✓</span>
                  )}
                  {isWrong && (
                    <span style={{ position: 'absolute', right: '20px', fontSize: '24px', color: '#ef4444', fontWeight: 900 }}>✗</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Feedback and next button */}
          {selectedAnswer && (
            <div style={{ marginTop: '32px' }}>
              <div 
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  border: '3px solid',
                  marginBottom: '16px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  ...(isCorrect
                    ? {
                        background: 'linear-gradient(to right, #dcfce7, #d1fae5)',
                        borderColor: '#22c55e',
                        color: '#166534',
                      }
                    : {
                        background: 'linear-gradient(to right, #fee2e2, #fecaca)',
                        borderColor: '#ef4444',
                        color: '#991b1b',
                      }
                  ),
                }}
              >
                <p style={{ fontSize: '24px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '32px' }}>{isCorrect ? '✓' : '✗'}</span>
                  <span>{isCorrect ? 'Correct!' : 'Incorrect'}</span>
                </p>
                {!isCorrect && (
                  <p style={{ fontSize: '14px', marginTop: '12px', fontWeight: 600, opacity: 0.95 }}>
                    The correct answer is: <strong style={{ fontSize: '16px', color: '#111827' }}>{question.correctAnswer}</strong>
                  </p>
                )}
              </div>
              <button
                onClick={handleNextQuestion}
                style={{
                  width: '100%',
                  padding: '16px 32px',
                  background: 'linear-gradient(to right, #2563eb, #9333ea, #4f46e5)',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '18px',
                  fontWeight: 900,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 10px 20px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 30px 60px -12px rgba(37, 99, 235, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(37, 99, 235, 0.5)';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
                }}
              >
                {currentQuestion + 1 >= QUIZ_QUESTIONS.length ? 'Finish Quiz →' : 'Next Question →'}
              </button>
            </div>
          )}
        </div>
      </div>
  );
}
