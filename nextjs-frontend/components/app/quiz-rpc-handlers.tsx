"use client";

import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";

export function RpcHandlers() {
  const room = useRoomContext();

  useEffect(() => {
    if (!room) return;

    const handleShowQuizLink = async (data: any): Promise<string> => {
      try {
        const payload = typeof data.payload === "string" ? JSON.parse(data.payload) : data.payload;
        const quizUrl = payload?.quizUrl || "http://localhost:3001";

        // Remove any existing quiz link popup
        const existing = document.querySelector('[data-quiz-link-popup="true"]');
        if (existing) {
          existing.remove();
        }

        // Create overlay
        const overlay = document.createElement("div");
        overlay.setAttribute("data-quiz-link-popup", "true");
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          animation: fadeIn 0.3s ease-out;
        `;

        // Add CSS animations
        const style = document.createElement("style");
        style.textContent = `
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
        `;
        if (!document.head.querySelector('style[data-quiz-link-styles]')) {
          style.setAttribute('data-quiz-link-styles', 'true');
        document.head.appendChild(style);
        }

        // Create popup card
        const popup = document.createElement("div");
        popup.style.cssText = `
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          padding: 0;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.4s ease-out;
          overflow: hidden;
        `;

        // Create inner content container
        const content = document.createElement("div");
        content.style.cssText = `
          background: white;
          margin: 3px;
          border-radius: 17px;
          padding: 40px;
          text-align: center;
        `;

        // Icon/Emoji
        const icon = document.createElement("div");
        icon.style.cssText = `
          font-size: 64px;
          margin-bottom: 20px;
          animation: pulse 2s ease-in-out infinite;
        `;
        icon.textContent = "📝";

        // Title
        const title = document.createElement("h2");
        title.style.cssText = `
          margin: 0 0 12px 0;
          font-size: 28px;
          font-weight: 700;
          color: #1f2937;
          letter-spacing: -0.5px;
        `;
        title.textContent = "Ready to Begin?";

        // Description
        const description = document.createElement("p");
        description.style.cssText = `
          margin: 0 0 32px 0;
          font-size: 16px;
          color: #6b7280;
          line-height: 1.6;
        `;
        description.textContent = "Click the link below to open the quiz in a new tab. The proctor will remain here to monitor your session.";

        // Link button
        const linkButton = document.createElement("a");
        linkButton.href = quizUrl;
        linkButton.target = "_blank";
        linkButton.rel = "noopener noreferrer";
        linkButton.style.cssText = `
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
          text-decoration: none;
          padding: 16px 32px;
          border-radius: 12px;
              font-size: 18px;
              font-weight: 600;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          transition: all 0.3s ease;
              cursor: pointer;
          border: none;
        `;
        linkButton.textContent = "Open Quiz →";
        
        // Hover effects
        linkButton.addEventListener("mouseenter", () => {
          linkButton.style.transform = "translateY(-2px)";
          linkButton.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.5)";
        });
        linkButton.addEventListener("mouseleave", () => {
          linkButton.style.transform = "translateY(0)";
          linkButton.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)";
        });

        // Close button
        const closeButton = document.createElement("button");
        closeButton.innerHTML = "×";
        closeButton.style.cssText = `
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          font-size: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          font-weight: 300;
          line-height: 1;
        `;
        closeButton.addEventListener("mouseenter", () => {
          closeButton.style.background = "rgba(255, 255, 255, 0.3)";
          closeButton.style.transform = "rotate(90deg)";
        });
        closeButton.addEventListener("mouseleave", () => {
          closeButton.style.background = "rgba(255, 255, 255, 0.2)";
          closeButton.style.transform = "rotate(0deg)";
        });
        
        // Close popup function
        const closePopup = () => {
          overlay.remove();
        };
        closeButton.addEventListener("click", closePopup);
        
        // When link is clicked, close popup
        linkButton.addEventListener("click", closePopup);

        // Assemble popup
        content.appendChild(icon);
        content.appendChild(title);
        content.appendChild(description);
        content.appendChild(linkButton);
        popup.appendChild(closeButton);
        popup.appendChild(content);
        overlay.appendChild(popup);

        // Close on overlay click (but not on popup click)
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) {
            closePopup();
          }
        });

        // Add to page
        document.body.appendChild(overlay);

        return "Quiz link popup displayed";
      } catch (err) {
        return "Error: " + (err instanceof Error ? err.message : String(err));
      }
    };

    // Register RPC methods
    room.localParticipant.registerRpcMethod("frontend.showQuizLink", async (data) => await handleShowQuizLink(data));

    return () => {
      try {
        room.localParticipant.unregisterRpcMethod("frontend.showQuizLink");
      } catch (error) {
        // Ignore errors during cleanup
      }
      // Clean up any existing popups and styles
      const existing = document.querySelector('[data-quiz-link-popup="true"]');
      if (existing) {
        existing.remove();
      }
      const styleElement = document.head.querySelector('style[data-quiz-link-styles]');
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, [room]);

  return null;
}
