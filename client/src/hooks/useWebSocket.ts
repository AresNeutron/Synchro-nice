import { useState, useEffect, useRef, useCallback } from "react";
import type {
  AudioChunkData,
  AudioProcessingStatus,
  UseWebSocketReturn,
  WebSocketMessage,
} from "../types";

export const useWebSocket = (): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  // Modificación: Ahora chunks es un array para guardar todos los pedazos.
  const [chunks, setChunks] = useState<AudioChunkData[]>([]);
  const [status, setStatus] = useState<AudioProcessingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const connect = useCallback((sessionId: string) => {
    // Cerrar conexión existente si la hay
    if (wsRef.current) {
      wsRef.current.close(1000, "Reconectando con nuevo sessionId");
    }

    // Reiniciar estados para la nueva conexión
    setIsConnected(false);
    setStatus(null);
    // Modificación: Limpiar el array de chunks al reconectar.
    setChunks([]);
    setError(null);

    sessionIdRef.current = sessionId;
    const wsUrl = `ws://localhost:8000/ws/${sessionId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket conectado");
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case "chunk_data": {
              const chunkData = message.data as AudioChunkData;
              // Modificación: Agregar el nuevo chunk al array.
              setChunks(prevChunks => [...prevChunks, chunkData]);
              console.log("RESPUESTA DEL SERVIDOR: PEDAZO: ");
              console.log(chunkData);
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
              // Cerrar la conexión si el servidor envía un error
              wsRef.current?.close(1001, errorData.message);
              break;
            }
            default:
              console.warn("Tipo de mensaje desconocido:", message.type);
          }
        } catch (err) {
          console.error("Error parseando mensaje WebSocket:", err);
          setError("Error parseando datos del servidor");
        }
      };

      ws.onerror = () => {
        console.warn(
          "Error WebSocket. El estado final se determinará con el cierre."
        );
      };

      ws.onclose = (event) => {
        console.log("WebSocket cerrado:", event.code, event.reason);
        setIsConnected(false);

        if (event.code !== 1000) {
          setError(`Conexión cerrada: ${event.reason || "Razón desconocida"}`);
        }
      };
    } catch (err) {
      console.error("Error creando WebSocket:", err);
      setError("No se pudo establecer conexión WebSocket");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, "Desconexión intencional");
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

  // Modificación: Devolvemos el array de chunks en lugar de un solo chunk.
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