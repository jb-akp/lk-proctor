'use client';

import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { TokenSource } from 'livekit-client';
import { SessionProvider, useSession } from '@livekit/components-react';

interface ConnectionContextType {
  isConnectionActive: boolean;
  connect: (startSession?: boolean) => void;
  startDisconnectTransition: () => void;
  onDisconnectTransitionComplete: () => void;
}

const ConnectionContext = createContext<ConnectionContextType>({
  isConnectionActive: false,
  connect: () => {},
  startDisconnectTransition: () => {},
  onDisconnectTransitionComplete: () => {},
});

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return ctx;
}

interface ConnectionProviderProps {
  children: React.ReactNode;
}

export function ConnectionProvider({ children }: ConnectionProviderProps) {
  const [isConnectionActive, setIsConnectionActive] = useState(false);

  const tokenSource = useMemo(() => {
    return TokenSource.custom(async () => {
      // Get room name from URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const roomName = urlParams.get('room');
      
      if (!roomName) {
        throw new Error('Room name not provided in URL. Please access the quiz through the proctor interface.');
      }

      const url = new URL('/api/connection-details', window.location.origin);

      try {
        const res = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            room_name: roomName, // Pass existing room name
            room_config: {
              agents: [{ agent_name: 'trivia-agent' }],
            },
          }),
        });

        if (!res.ok) {
          throw new Error(`Failed to get connection details: ${res.statusText}`);
        }

        const data = await res.json();
        // Return the full connection details object, not just the token
        return data;
      } catch (error) {
        console.error('Error getting connection details:', error);
        throw error;
      }
    });
  }, []);

  const session = useSession(tokenSource, { agentName: 'trivia-agent' });
  const { start: startSession, end: endSession, room } = session;

  useEffect(() => {
    // Auto-connect when component mounts (RPC only, no media publishing)
    setIsConnectionActive(true);
    
    // Suppress publish track errors (expected - we don't publish tracks)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      if (error?.message?.includes('insufficient permissions') || 
          error?.message?.includes('PublishTrackError') ||
          error?.name === 'PublishTrackError') {
        event.preventDefault(); // Suppress this expected error
        return;
      }
    };

    const handleError = (event: ErrorEvent) => {
      const error = event.error;
      if (error?.message?.includes('insufficient permissions') || 
          error?.message?.includes('PublishTrackError') ||
          error?.name === 'PublishTrackError') {
        event.preventDefault(); // Suppress this expected error
        return;
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    startSession().catch((error) => {
      // Suppress publish track errors during session start
      if (error?.message?.includes('insufficient permissions') || 
          error?.message?.includes('PublishTrackError') ||
          error?.name === 'PublishTrackError') {
        return; // Expected error, ignore
      }
      console.error('Session start error:', error);
    });

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, [startSession]);

  const connect = (startSessionParam = true) => {
    setIsConnectionActive(true);
    if (startSessionParam) {
      startSession();
    }
  };

  const startDisconnectTransition = () => {
    setIsConnectionActive(false);
  };

  const onDisconnectTransitionComplete = () => {
    endSession();
  };

  return (
    <ConnectionContext.Provider
      value={{
        isConnectionActive,
        connect,
        startDisconnectTransition,
        onDisconnectTransitionComplete,
      }}
    >
      <SessionProvider session={session}>{children}</SessionProvider>
    </ConnectionContext.Provider>
  );
}

