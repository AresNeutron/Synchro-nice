import { useState, useEffect, useRef, useCallback } from "react";
import type {
  AudioChunkData,
  AudioAnalysisMessage,
  AudioProcessingStatus,
  UseWebSocketReturn,
  WebSocketMessage,
} from "../types";
import { backend_url } from "../utils/url";

export const useWebSocket = (): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [chunks, setChunks] = useState<AudioChunkData[]>([]); // Latest chunks for backward compatibility
  // Store the analysis data, only one at a time (updated every 5 chunks / 1 second)
  const [analysis, setAnalysis] = useState<AudioAnalysisMessage | null>(null);
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
    // Clear all chunk data on reconnect
    setChunks([]);
    setAnalysis(null);
    setError(null);

    sessionIdRef.current = sessionId;
    const wsUrl = `${backend_url.replace("http://", "ws://")}/ws/${sessionId}`;

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

              // Keep latest chunks array for backward compatibility
              setChunks(prevChunks => {
                const newChunks = [...prevChunks, chunkData];
                if (newChunks.length > 10) {
                  return newChunks.slice(1);
                }
                return newChunks;
              });
              break;
            }
            case "audio_analysis": {
              const analysisData = message.data as AudioAnalysisMessage;
              setAnalysis(analysisData);
              console.log("Analysis updated:", analysisData);
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

  const sendGetAnalysisSignal = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = { action: "get_analysis" };
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendTimeBasedRequest = useCallback((currentTime: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Request chunks for current time
      const chunksMessage = { 
        action: "get_chunks_for_time", 
        current_time: currentTime,
        buffer_ahead: 3.0
      };
      wsRef.current.send(JSON.stringify(chunksMessage));
      
      // Request analysis for current time
      const analysisMessage = { 
        action: "get_analysis_for_time", 
        current_time: currentTime
      };
      wsRef.current.send(JSON.stringify(analysisMessage));
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
    analysis,
    status,
    error,
    sendGetChunkSignal,
    sendGetAnalysisSignal,
    // un punto importante: si podemos obtener ambos datos por tiempo, entonces lo más probable es que
    // los dos métodos anteriores no hagan falta
    sendTimeBasedRequest,
  };
};