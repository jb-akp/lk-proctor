"use client";

import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";

export function RpcHandlers() {
  const room = useRoomContext();

  useEffect(() => {
    if (!room) return;

    const handleShowQuiz = async (data: any): Promise<string> => {
      try {
        if (!data || data.payload === undefined) {
          return "Error: Invalid RPC data format";
        }

        const payload = typeof data.payload === "string" ? JSON.parse(data.payload) : data.payload;
        const quizType = payload?.type;
        const questionNumber = payload?.question_number || 1;
        const totalQuestions = payload?.total_questions || 4;

        if (quizType !== "trivia_quiz") {
          return "Error: Unknown quiz type";
        }

        const question = payload?.question || "";
        const options = payload?.options || [];

        if (!Array.isArray(options) || options.length === 0) {
          return "Error: Invalid quiz options";
        }

        // Create quiz popup
        const overlay = document.createElement("div");
        overlay.setAttribute("data-quiz-overlay", "true");
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const quizPopup = document.createElement("div");
        quizPopup.style.cssText = `
          background: white;
          border-radius: 12px;
          padding: 32px;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          animation: slideDown 0.3s ease-out;
        `;

        // Add CSS animations
        const style = document.createElement("style");
        style.textContent = `
          @keyframes slideDown {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes checkmarkDraw {
            0% { stroke-dashoffset: 100; }
            100% { stroke-dashoffset: 0; }
          }
          @keyframes scaleIn {
            0% { transform: scale(0); opacity: 0; }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes pop {
            0% { transform: scale(0.8); opacity: 0; }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
          }
        `;
        document.head.appendChild(style);

        // Create quiz content
        const quizContent = document.createElement("div");
        quizContent.innerHTML = `
          <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #6b7280; text-align: center;">
            Question ${questionNumber} of ${totalQuestions}
          </h2>
          <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #1f2937; text-align: center;">
            Trivia Quiz
          </h2>
          <p style="margin: 0 0 32px 0; font-size: 36px; color: #1f2937; text-align: center; font-weight: 600;">
            ${question}
          </p>
          <div id="quiz-options" style="display: grid; gap: 12px; margin-bottom: 16px;"></div>
        `;

        // Create answer buttons
        const optionsContainer = quizContent.querySelector("#quiz-options") as HTMLDivElement;
        options.forEach((option: number | string, index: number) => {
          const button = document.createElement("button");
          button.textContent = String(option);
          button.style.cssText = `
            padding: 16px 24px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          `;
          button.addEventListener("mouseenter", () => {
            button.style.background = "#2563eb";
            button.style.transform = "scale(1.02)";
          });
          button.addEventListener("mouseleave", () => {
            button.style.background = "#3b82f6";
            button.style.transform = "scale(1)";
          });
          button.addEventListener("click", async () => {
            // Disable all buttons
            optionsContainer.querySelectorAll("button").forEach((btn) => {
              (btn as HTMLButtonElement).disabled = true;
              (btn as HTMLButtonElement).style.cursor = "not-allowed";
              (btn as HTMLButtonElement).style.opacity = "0.6";
            });

            try {
              // Send answer to agent via RPC
              // remoteParticipants only contains non-local participants (i.e., the agent)
              const remoteParticipants = Array.from(room.remoteParticipants.values());
              const agentParticipant = remoteParticipants[0];

              if (!agentParticipant) {
                throw new Error("Agent participant not found");
              }

              const agentIdentity = agentParticipant.identity;

              const response = await room.localParticipant.performRpc({
                destinationIdentity: agentIdentity,
                method: "agent.submitQuizAnswer",
                payload: JSON.stringify({
                  answer: option,
                }),
              });

              // Parse the response to determine if answer was correct
              const result = typeof response === "string" ? JSON.parse(response) : response;
              const isCorrect = result?.status === "correct";

              // Show immediate visual feedback
              showFeedbackPopup(isCorrect, overlay);

              // Close quiz after showing feedback
              setTimeout(() => {
                closeQuiz();
              }, 2000); // Show feedback for 2 seconds
            } catch (error) {
              console.error("Error submitting quiz answer:", error);
              // Re-enable buttons on error
              optionsContainer.querySelectorAll("button").forEach((btn) => {
                (btn as HTMLButtonElement).disabled = false;
                (btn as HTMLButtonElement).style.cursor = "pointer";
                (btn as HTMLButtonElement).style.opacity = "1";
              });
            }
          });
          optionsContainer.appendChild(button);
        });

        quizPopup.appendChild(quizContent);
        overlay.appendChild(quizPopup);
        document.body.appendChild(overlay);

        // Function to show feedback popup (checkmark or X)
        const showFeedbackPopup = (isCorrect: boolean, quizOverlay: HTMLElement) => {
          // Hide the quiz popup
          quizPopup.style.opacity = "0";
          quizPopup.style.transform = "scale(0.8)";
          quizPopup.style.transition = "all 0.3s ease-out";

          // Create feedback popup
          const feedbackPopup = document.createElement("div");
          feedbackPopup.style.cssText = `
            background: ${isCorrect ? "#10b981" : "#ef4444"};
            border-radius: 16px;
            padding: 48px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            min-width: 200px;
          `;

          if (isCorrect) {
            // Green checkmark
            feedbackPopup.innerHTML = `
              <svg width="80" height="80" viewBox="0 0 80 80" style="margin-bottom: 16px;">
                <circle cx="40" cy="40" r="36" fill="white" opacity="0.2"/>
                <path 
                  d="M 25 40 L 35 50 L 55 30" 
                  stroke="white" 
                  stroke-width="6" 
                  stroke-linecap="round" 
                  stroke-linejoin="round"
                  fill="none"
                  style="stroke-dasharray: 100; stroke-dashoffset: 100; animation: checkmarkDraw 0.6s ease-out 0.2s forwards;"
                />
              </svg>
              <h3 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">
                Correct!
              </h3>
            `;
          } else {
            // Red X
            feedbackPopup.innerHTML = `
              <svg width="80" height="80" viewBox="0 0 80 80" style="margin-bottom: 16px;">
                <circle cx="40" cy="40" r="36" fill="white" opacity="0.2"/>
                <path 
                  d="M 30 30 L 50 50 M 50 30 L 30 50" 
                  stroke="white" 
                  stroke-width="6" 
                  stroke-linecap="round"
                  fill="none"
                  style="animation: pop 0.4s ease-out;"
                />
              </svg>
              <h3 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">
                Incorrect
              </h3>
            `;
          }

          quizPopup.innerHTML = "";
          quizPopup.style.background = "transparent";
          quizPopup.style.padding = "0";
          quizPopup.style.boxShadow = "none";
          quizPopup.appendChild(feedbackPopup);
          quizPopup.style.opacity = "1";
          quizPopup.style.transform = "scale(1)";
        };

        // Close quiz function
        const closeQuiz = () => {
          overlay.style.animation = "slideDown 0.3s ease-out reverse";
          setTimeout(() => {
            if (overlay.parentNode) {
              overlay.parentNode.removeChild(overlay);
            }
            if (style.parentNode) {
              style.parentNode.removeChild(style);
            }
          }, 300);
        };

        return "Quiz displayed";
      } catch (err) {
        return "Error: " + (err instanceof Error ? err.message : String(err));
      }
    };

    const handleShowStartQuiz = async (data: any): Promise<string> => {
      try {
        if (!data || data.payload === undefined) {
          return "Error: Invalid RPC data format";
        }

        const payload = typeof data.payload === "string" ? JSON.parse(data.payload) : data.payload;
        const totalQuestions = payload?.total_questions || 4;

        // Create start quiz popup
        const overlay = document.createElement("div");
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const startPopup = document.createElement("div");
        startPopup.style.cssText = `
          background: white;
          border-radius: 16px;
          padding: 48px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          text-align: center;
        `;

        // Add CSS animations if not already present
        if (!document.getElementById("quiz-animations")) {
          const style = document.createElement("style");
          style.id = "quiz-animations";
          style.textContent = `
            @keyframes scaleIn {
              0% { transform: scale(0); opacity: 0; }
              50% { transform: scale(1.1); }
              100% { transform: scale(1); opacity: 1; }
            }
          `;
          document.head.appendChild(style);
        }

        startPopup.innerHTML = `
          <div style="font-size: 64px; margin-bottom: 16px;">📝</div>
          <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #1f2937;">
            Ready to Start?
          </h2>
          <p style="margin: 0 0 32px 0; font-size: 16px; color: #6b7280;">
            You'll have ${totalQuestions} trivia questions to test your knowledge.
          </p>
          <button 
            id="start-quiz-btn"
            style="
              padding: 14px 40px;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 18px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
            "
            onmouseover="this.style.background='#2563eb'; this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 16px rgba(59, 130, 246, 0.5)'"
            onmouseout="this.style.background='#3b82f6'; this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.4)'"
          >
            Start Quiz
          </button>
        `;

        overlay.appendChild(startPopup);
        document.body.appendChild(overlay);

        // Start button handler
        const startBtn = startPopup.querySelector("#start-quiz-btn") as HTMLButtonElement;
        const startQuiz = async () => {
          try {
            startBtn.disabled = true;
            startBtn.textContent = "Starting...";
            startBtn.style.opacity = "0.7";
            startBtn.style.cursor = "not-allowed";

            // Send RPC to agent to start the quiz
            const remoteParticipants = Array.from(room.remoteParticipants.values());
            const agentParticipant = remoteParticipants[0];

            if (!agentParticipant) {
              throw new Error("Agent participant not found");
            }

            await room.localParticipant.performRpc({
              destinationIdentity: agentParticipant.identity,
              method: "agent.startQuiz",
              payload: JSON.stringify({}),
            });

            // Close the start popup
            overlay.style.animation = "scaleIn 0.3s ease-out reverse";
            setTimeout(() => {
              if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
              }
            }, 300);
          } catch (error) {
            console.error("Error starting quiz:", error);
            startBtn.disabled = false;
            startBtn.textContent = "Start Quiz";
            startBtn.style.opacity = "1";
            startBtn.style.cursor = "pointer";
          }
        };

        startBtn.addEventListener("click", startQuiz);

        return "Start quiz popup displayed";
      } catch (err) {
        return "Error: " + (err instanceof Error ? err.message : String(err));
      }
    };

    const handleShowScore = async (data: any): Promise<string> => {
      try {
        if (!data || data.payload === undefined) {
          return "Error: Invalid RPC data format";
        }

        const payload = typeof data.payload === "string" ? JSON.parse(data.payload) : data.payload;
        const score = payload?.score || 0;
        const total = payload?.total || 4;
        const percentage = payload?.percentage || 0;

        // Create score popup
        const overlay = document.createElement("div");
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const scorePopup = document.createElement("div");
        scorePopup.style.cssText = `
          background: white;
          border-radius: 16px;
          padding: 48px;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          text-align: center;
        `;

        // Determine color based on score
        const color = percentage >= 75 ? "#10b981" : percentage >= 50 ? "#f59e0b" : "#ef4444";
        const emoji = percentage === 100 ? "🎉" : percentage >= 75 ? "👍" : percentage >= 50 ? "😊" : "💪";

        scorePopup.innerHTML = `
          <div style="font-size: 64px; margin-bottom: 16px;">${emoji}</div>
          <h2 style="margin: 0 0 16px 0; font-size: 32px; font-weight: 700; color: #1f2937;">
            Quiz Complete!
          </h2>
          <div style="font-size: 72px; font-weight: 800; color: ${color}; margin: 24px 0;">
            ${score}/${total}
          </div>
          <div style="font-size: 24px; color: #6b7280; margin-bottom: 32px; font-weight: 600;">
            ${percentage}%
          </div>
          <button 
            id="close-score-btn"
            style="
              padding: 12px 32px;
              background: ${color};
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 18px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
            "
            onmouseover="this.style.opacity='0.9'; this.style.transform='scale(1.05)'"
            onmouseout="this.style.opacity='1'; this.style.transform='scale(1)'"
          >
            Close
          </button>
        `;

        overlay.appendChild(scorePopup);
        document.body.appendChild(overlay);

        // Add CSS animations if not already present
        if (!document.getElementById("quiz-animations")) {
          const style = document.createElement("style");
          style.id = "quiz-animations";
          style.textContent = `
            @keyframes scaleIn {
              0% { transform: scale(0); opacity: 0; }
              50% { transform: scale(1.1); }
              100% { transform: scale(1); opacity: 1; }
            }
          `;
          document.head.appendChild(style);
        }

        // Close button handler
        const closeBtn = scorePopup.querySelector("#close-score-btn") as HTMLButtonElement;
        const closeScore = () => {
          overlay.style.animation = "scaleIn 0.3s ease-out reverse";
          setTimeout(() => {
            if (overlay.parentNode) {
              overlay.parentNode.removeChild(overlay);
            }
          }, 300);
        };

        closeBtn.addEventListener("click", closeScore);
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) {
            closeScore();
          }
        });

        return "Score displayed";
      } catch (err) {
        return "Error: " + (err instanceof Error ? err.message : String(err));
      }
    };

    const handleHideQuiz = async (): Promise<string> => {
      const overlay = document.querySelector('[data-quiz-overlay="true"]') as HTMLElement;
      if (overlay) {
        overlay.style.display = "none";
      }
      return "Quiz hidden";
    };

    const handleShowQuizModal = async (): Promise<string> => {
      const overlay = document.querySelector('[data-quiz-overlay="true"]') as HTMLElement;
      if (overlay) {
        overlay.style.display = "flex";
      }
      return "Quiz shown";
    };

    room.localParticipant.registerRpcMethod("client.showQuiz", handleShowQuiz);
    room.localParticipant.registerRpcMethod("client.showStartQuiz", handleShowStartQuiz);
    room.localParticipant.registerRpcMethod("client.showScore", handleShowScore);
    room.localParticipant.registerRpcMethod("client.hideQuiz", handleHideQuiz);
    room.localParticipant.registerRpcMethod("client.showQuizModal", handleShowQuizModal);

    return () => {
      room.localParticipant.unregisterRpcMethod("client.showQuiz");
      room.localParticipant.unregisterRpcMethod("client.showStartQuiz");
      room.localParticipant.unregisterRpcMethod("client.showScore");
      room.localParticipant.unregisterRpcMethod("client.hideQuiz");
      room.localParticipant.unregisterRpcMethod("client.showQuizModal");
    };
  }, [room]);

  return null;
}
