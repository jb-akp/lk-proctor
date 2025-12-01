"use client";

import { useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";

function QuizLinkPopup({ quizUrl, onClose }: { quizUrl: string; onClose: () => void }) {
  const [isHoveringLink, setIsHoveringLink] = useState(false);
  const [isHoveringClose, setIsHoveringClose] = useState(false);

  useEffect(() => {
    // Add CSS animations to the document
    const styleId = 'quiz-link-popup-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes quizLinkFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes quizLinkSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes quizLinkPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .quiz-link-overlay {
          animation: quizLinkFadeIn 0.3s ease-out;
        }
        .quiz-link-popup {
          animation: quizLinkSlideUp 0.4s ease-out;
        }
        .quiz-link-icon {
          animation: quizLinkPulse 2s ease-in-out infinite;
        }
      `;
      document.head.appendChild(style);
    }

    return () => {
      // Clean up styles when component unmounts
      const style = document.getElementById(styleId);
      if (style) {
        style.remove();
      }
    };
  }, []);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleLinkClick = () => {
    onClose();
  };

  return (
    <div
      className="quiz-link-overlay fixed inset-0 z-[10000] flex items-center justify-center"
      style={{
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={handleOverlayClick}
    >
      <div
        className="quiz-link-popup relative overflow-hidden rounded-[20px] p-0 shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          maxWidth: '500px',
          width: '90%',
        }}
      >
        <button
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border-none text-2xl font-light leading-none text-white transition-all duration-200"
          style={{
            background: isHoveringClose ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.2)',
            transform: isHoveringClose ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
          onClick={onClose}
          onMouseEnter={() => setIsHoveringClose(true)}
          onMouseLeave={() => setIsHoveringClose(false)}
        >
          ×
        </button>

        <div className="m-[3px] rounded-[17px] bg-white p-10 text-center">
          <div className="quiz-link-icon mb-5 text-6xl">📝</div>

          <h2
            className="m-0 mb-3 text-[28px] font-bold leading-tight tracking-[-0.5px] text-gray-900"
          >
            Ready to Begin?
          </h2>

          <p className="m-0 mb-8 text-base leading-relaxed text-gray-600">
            Click the link below to open the quiz in a new tab. The proctor will remain here to monitor your session.
          </p>

          <a
            href={quizUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-xl px-8 py-4 text-lg font-semibold text-white no-underline transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: isHoveringLink
                ? '0 6px 20px rgba(102, 126, 234, 0.5)'
                : '0 4px 15px rgba(102, 126, 234, 0.4)',
              transform: isHoveringLink ? 'translateY(-2px)' : 'translateY(0)',
            }}
            onClick={handleLinkClick}
            onMouseEnter={() => setIsHoveringLink(true)}
            onMouseLeave={() => setIsHoveringLink(false)}
          >
            Open Quiz →
          </a>
        </div>
      </div>
    </div>
  );
}

export function RpcHandlers() {
  const room = useRoomContext();
  const [quizPopup, setQuizPopup] = useState<{ quizUrl: string } | null>(null);

  useEffect(() => {
    if (!room) return;

    const handleShowQuizLink = async (data: any): Promise<string> => {
      try {
        // Quiz URL is hardcoded, no payload needed
        const quizUrl = "http://localhost:3001";
        
        setQuizPopup({ quizUrl });
        return "Quiz link popup displayed";
      } catch (err) {
        return "Error: " + (err instanceof Error ? err.message : String(err));
      }
    };

    // Register RPC methods
    room.registerRpcMethod("frontend.showQuizLink", async (data) => await handleShowQuizLink(data));

    return () => {
      try {
        room.unregisterRpcMethod("frontend.showQuizLink");
      } catch (error) {
        // Ignore errors during cleanup
      }
    };
  }, [room]);

  if (!quizPopup) {
    return null;
  }

  return (
    <QuizLinkPopup
      quizUrl={quizPopup.quizUrl}
      onClose={() => setQuizPopup(null)}
    />
  );
}
