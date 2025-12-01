"use client";

import { useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { QuizLinkPopup } from "./quiz-link-popup";

export function RpcHandlers() {
  const room = useRoomContext();
  const [quizPopup, setQuizPopup] = useState<{ quizUrl: string } | null>(null);

  useEffect(() => {
    if (!room) return;

    const handleShowQuizLink = async (data: any): Promise<string> => {
      try {
        const payload = typeof data.payload === "string" ? JSON.parse(data.payload) : data.payload;
        const quizUrl = payload?.quizUrl || "http://localhost:3001";
        
        setQuizPopup({ quizUrl });
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
