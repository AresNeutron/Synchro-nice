export interface AudioChunkData {
  timestamp: number;
  frequencies: number[]; // 20 frequency bands
  amplitude: number; // 0.0 to 1.0
  brightness: number; // Normalized spectral centroid
  energy_center: number; // Frequency where energy is concentrated (Hz)
  is_percussive: boolean; // If there is percussion in this chunk
  rolloff: number; // Spectral rolloff
  zero_crossing_rate: number; // Zero-crossing rate
  spectral_flatness: number; // How "noisy" or "tonal" the sound is (0.0 to 1.0)
  chroma_features: number[]; // Amplitude of each of the 12 musical notes
  beat_strength: number; // How strong or clear the rhythmic pulse is
  tempo: number; // Music speed in beats per minute (BPM)
}

export interface AudioProcessingStatus {
  status: 'processing' | 'completed' | 'error' | 'ready';
  progress: number;
  total_chunks: number;
  processed_chunks: number;
  duration: number;
}

export interface WebSocketMessage {
  type: 'chunk_data' | 'status' | 'error';
  data: AudioChunkData | AudioProcessingStatus | { message: string };
}

export interface AudioFileInfo {
  filename: string;
  duration: number;
  sample_rate: number;
  channels: number;
  file_path: string;
}

export interface UploadResponse {
  session_id: string;
  file_info: AudioFileInfo;
  total_chunks: number;
}


export const APPSTATE = {
    INIT: 0,
    UPLOADING: 1,
    PROCESSING: 2,
    PLAYING: 3,
    PAUSED: 4,
    ERROR: 5,
} as const;

export type AppState = typeof APPSTATE[keyof typeof APPSTATE];


export interface UseWebSocketReturn {
  connect: (sessionId: string) => void;
  disconnect: () => void;
  isConnected: boolean;
  chunks: AudioChunkData[];
  status: AudioProcessingStatus | null;
  error: string | null;
  sendGetChunkSignal: () => void;
}

export const initialVisualizerState: AudioChunkData = {
    timestamp: 0,
    frequencies: Array(20).fill(0),
    amplitude: 0,
    brightness: 0,
    energy_center: 0,
    is_percussive: false,
    rolloff: 0,
    zero_crossing_rate: 0,
    spectral_flatness: 0,
    chroma_features: Array(12).fill(0),
    beat_strength: 0,
    tempo: 0,
};
