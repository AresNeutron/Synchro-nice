import type { AppState, AudioFileInfo, AudioChunkData, AudioAnalysisMessage } from './index';

export interface AppContextType {
  appState: AppState;
  setAppState: (state: AppState) => void;

  fileInfo: AudioFileInfo | null;
  setFileInfo: (info: AudioFileInfo | null) => void;

  sessionId: string | null;
  uploadFile: (file: File) => Promise<void>;
  
  // Complete audio dataset stored locally
  audioChunks: AudioChunkData[];
  audioAnalysis: AudioAnalysisMessage[];
  loadingProgress: { chunks: number; analysis: number; isComplete: boolean };
  
  // Function to get chunk by timestamp for synchronization
  getChunkByTimestamp: (timestamp: number) => AudioChunkData | null;
  getAnalysisByTimestamp: (timestamp: number) => AudioAnalysisMessage | null;
}