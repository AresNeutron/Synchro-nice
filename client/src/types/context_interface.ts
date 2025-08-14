import type { AppState, AudioFileInfo, AudioChunkData, AudioAnalysisMessage, AudioProcessingStatus } from './index';

export interface AppContextType {
  appState: AppState;
  setAppState: (state: AppState) => void;

  fileInfo: AudioFileInfo | null;
  setFileInfo: (info: AudioFileInfo | null) => void;

  sessionId: string | null;
  uploadFile: (file: File) => Promise<void>;

  chunks: AudioChunkData[];
  analysis: AudioAnalysisMessage | null;
  processingStatus: AudioProcessingStatus | null;
  isConnected: boolean;
  webSocketError: string | null;
  sendGetChunkSignal: () => void;
  sendGetAnalysisSignal: () => void;
}