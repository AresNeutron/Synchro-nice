import type { UploadResponse, AppState, AudioFileInfo, AudioChunkData, AudioProcessingStatus } from './index';

export interface AppContextType {
  appState: AppState;
  setAppState: (state: AppState) => void;

  fileInfo: AudioFileInfo | null;
  setFileInfo: (info: AudioFileInfo | null) => void;

  sessionId: string | null;
  uploadFile: (file: File) => Promise<UploadResponse>;

  chunks: AudioChunkData[];
  processingStatus: AudioProcessingStatus | null;
  isConnected: boolean;
  webSocketError: string | null;
  sendGetChunkSignal: () => void;
  getInitialChunks: () => void;
}