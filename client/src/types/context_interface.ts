import type { AppState, AudioFileInfo } from './index';

export interface AppContextType {
  appState: AppState;
  setAppState: (state: AppState) => void;

  fileInfo: AudioFileInfo | null;
  setFileInfo: (info: AudioFileInfo | null) => void;

  sessionId: string | null;
  uploadFile: (file: File) => Promise<void>;
}