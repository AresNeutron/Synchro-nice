import { useState, useEffect, useRef, useCallback } from "react";
import type {
  AudioChunkData,
  AudioProcessingStatus,
  UseWebSocketReturn,
  WebSocketMessage,
} from "../types";

export const useWebSocket = (): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  // Modification: 'chunks' is now an array to store all the chunks.
  const [chunks, setChunks] = useState<AudioChunkData[]>([]);
  const [status, setStatus] = useState<AudioProcessingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const connect = useCallback((sessionId: string) => {
    // Close existing connection if there is one
    if (wsRef.current) {
      wsRef.current.close(1000, "Reconnecting with new sessionId");
    }

    // Reset states for the new connection
    setIsConnected(false);
    setStatus(null);
    // Modification: Clear the chunks array on reconnect.
    setChunks([]);
    setError(null);

    sessionIdRef.current = sessionId;
    const wsUrl = `ws://localhost:8000/ws/${sessionId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case "chunk_data": {
              const chunkData = message.data as AudioChunkData;

              setChunks(prevChunks => {
                const newChunks = [...prevChunks, chunkData];
                if (newChunks.length > 10) {
                  return newChunks.slice(1);
                }
                return newChunks;
              });
              break;
            }
            case "status": {
              const statusData = message.data as AudioProcessingStatus;
              setStatus(statusData);
              break;
            }
            case "error": {
              const errorData = message.data as { message: string };
              setError(errorData.message);
              wsRef.current?.close(1001, errorData.message);
              break;
            }
            default:
              console.warn("Unknown message type:", message.type);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
          setError("Error parsing data from server");
        }
      };

      ws.onerror = () => {
        console.warn(
          "WebSocket error. Final state will be determined on close."
        );
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        setIsConnected(false);

        if (event.code !== 1000) {
          setError(`Connection closed: ${event.reason || "Unknown reason"}`);
        }
      };
    } catch (err) {
      console.error("Error creating WebSocket:", err);
      setError("Could not establish WebSocket connection");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, "Intentional disconnection");
      wsRef.current = null;
    }
    setIsConnected(false);
    sessionIdRef.current = null;
  }, []);

  const sendGetChunkSignal = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = { action: "get_chunk" };
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    isConnected,
    chunks,
    status,
    error,
    sendGetChunkSignal,
  };
};