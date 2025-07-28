import { useState, useEffect, useRef, useCallback } from 'react';
import type { AudioChunkData, AudioProcessingStatus, UseWebSocketReturn, WebSocketMessage } from '../types';


export const useWebSocket = (): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [chunks, setChunks] = useState<AudioChunkData[]>([]);
  const [status, setStatus] = useState<AudioProcessingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const connect = useCallback((sessionId: string) => {
    // Cerrar conexión existente si la hay
    if (wsRef.current) {
      wsRef.current.close();
    }

    setChunks([]);
    setStatus(null);
    setError(null);

    sessionIdRef.current = sessionId;
    const wsUrl = `ws://localhost:8000/ws/${sessionId}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket conectado');
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'chunk_data': {
              // Agregar nuevo chunk a la lista
              const chunkData = message.data as AudioChunkData;
              setChunks(prev => [...prev, chunkData]);
              break;
            }
            case 'status': {
              // Actualizar estado del procesamiento
              const statusData = message.data as AudioProcessingStatus;
              setStatus(statusData);
              break;
            }
            case 'error': {
              // Manejar errores del servidor
              const errorData = message.data as { message: string };
              setError(errorData.message);
              break;
            }
            default:
              console.warn('Tipo de mensaje desconocido:', message.type);
          }
        } catch (err) {
          console.error('Error parseando mensaje WebSocket:', err);
          setError('Error parseando datos del servidor');
        }
      };

      ws.onerror = (event) => {
        console.error('Error WebSocket:', event);
        setError('Error de conexión WebSocket');
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        console.log('WebSocket cerrado:', event.code, event.reason);
        setIsConnected(false);
        
        // Solo mostrar error si no fue un cierre intencional
        if (event.code !== 1000) {
          setError(`Conexión cerrada: ${event.reason || 'Razón desconocida'}`);
        }
      };

    } catch (err) {
      console.error('Error creando WebSocket:', err);
      setError('No se pudo establecer conexión WebSocket');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Desconexión intencional');
      wsRef.current = null;
    }
    setIsConnected(false);
    sessionIdRef.current = null;
  }, []);

  // Limpiar al desmontar el componente
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
    error
  };
};