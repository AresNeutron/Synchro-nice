// src/context/AppContext.tsx
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import type { AppState, UploadResponse } from '../types';
import type { AppContextType } from '../types/context_interface';


const AppContext = createContext<AppContextType | undefined>(undefined);


export default function AppProvider ({ children }: {children: ReactNode}) {
  const [appState, setAppState] = useState<AppState>('idle');
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null); // Unificado para errores de subida o WS
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const { 
    connect, 
    disconnect, 
    isConnected, 
    chunks, 
    status: wsStatus, // Renombrar para evitar conflicto con el estado 'status' general
    error: wsError 
  } = useWebSocket();

  const handleUploadSuccess = useCallback((response: UploadResponse) => {
    console.log('Archivo subido exitosamente:', response);
    setUploadResponse(response);
    setAppState('processing');
    setError(null); 
    connect(response.session_id);
  }, [connect]);

  const handleUploadError = useCallback((errorMessage: string) => {
    console.error('Error en subida:', errorMessage);
    setError(errorMessage);
    setAppState('error');
    setUploadResponse(null);
    disconnect(); 
  }, [disconnect]);

  const handlePlayStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    if (playing && appState !== 'playing') {
      setAppState('playing');
    } else if (!playing && appState === 'playing') {
      setAppState('paused');
    }
  }, [appState]);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleReset = useCallback(() => {
    setAppState('idle');
    setUploadResponse(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setError(null);
    disconnect();
  }, [disconnect]);

  useEffect(() => {
    if (wsError) {
      setError(`Error de conexión WebSocket: ${wsError}`);
      setAppState('error');
    }
  }, [wsError]);

  useEffect(() => {
    if (wsStatus) {
      console.log('Estado del procesamiento:', wsStatus);
      if (wsStatus.status === 'completed' && appState === 'processing') {
        setAppState('paused');
      } else if (wsStatus.status === 'error') {
        setError('Error procesando el archivo de audio desde el servidor.');
        setAppState('error');
      }
    }
  }, [wsStatus, appState]);


  // Valor que será provisto a los componentes hijos
  const contextValue = {
    appState,
    uploadResponse,
    isUploading,
    error,
    isPlaying,
    currentTime,
    isConnected,
    chunks,
    wsStatus,
    wsError,
    handleUploadSuccess,
    handleUploadError,
    handlePlayStateChange,
    handleTimeUpdate,
    handleReset,
    setIsUploading,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// 4. Hook personalizado para consumir el contexto
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};