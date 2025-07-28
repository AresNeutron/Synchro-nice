import type { AppState, AudioChunkData, AudioProcessingStatus, UploadResponse } from ".";

export interface AppContextType {
  // Estados principales
  appState: AppState;
  uploadResponse: UploadResponse | null;
  isUploading: boolean;
  error: string | null;
  
  // Estados del reproductor de audio
  isPlaying: boolean;
  currentTime: number;

  // Datos de WebSocket
  isConnected: boolean;
  chunks: AudioChunkData[];
  wsStatus: AudioProcessingStatus | null; // Renombrado para evitar conflicto con 'status' general
  wsError: string | null;

  // Funciones de control
  handleUploadSuccess: (response: UploadResponse) => void;
  handleUploadError: (errorMessage: string) => void;
  handlePlayStateChange: (playing: boolean) => void;
  handleTimeUpdate: (time: number) => void;
  handleReset: () => void;
  setIsUploading: (uploading: boolean) => void; // Necesario para AudioUpload
}