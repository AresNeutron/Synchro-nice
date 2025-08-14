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

export interface TransitionAnalysis {
  amplitude_delta: number;
  brightness_delta: number;
  beat_strength_delta: number;
  frequency_deltas: number[];
  transition_smoothness: number;
  change_velocity: number;
  energy_direction: 'increasing' | 'decreasing' | 'stable';
}

export interface TrendAnalysis {
  amplitude_trend: number;
  brightness_trend: number;
  beat_strength_trend: number;
  frequency_trends: number[];
  overall_energy_trend: number;
  trend_strength: number;
  volatility: number;
}

export interface PatternAnalysis {
  detected_patterns: Array<{
    type: string;
    period: number;
    strength: number;
    last_occurrence: number;
  }>;
  pattern_strength: number;
  cycle_length: number | null;
  pattern_confidence: number;
}

export interface PredictionAnalysis {
  predicted_amplitude: number;
  predicted_brightness: number;
  predicted_beat_strength: number;
  predicted_energy_change: 'buildup' | 'drop' | 'stable' | 'breakdown';
  drop_probability: number;
  buildup_probability: number;
  break_probability: number;
}

export interface AudioRelationships {
  transitions: TransitionAnalysis;
  trends: TrendAnalysis;
  patterns: PatternAnalysis;
  predictions: PredictionAnalysis;
  analysis_window_size: number;
  buffer_size: number;
}

export interface AudioAnalysisMessage {
  current_chunk: AudioChunkData;
  relationships: AudioRelationships;
  analysis_timestamp: number;
  chunks_analyzed: number;
}

export interface WebSocketMessage {
  type: 'chunk_data' | 'status' | 'error' | 'audio_analysis';
  data: AudioChunkData | AudioProcessingStatus | { message: string } | AudioAnalysisMessage;
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
    INIT: 0, // initial state of the app
    UPLOADING: 1, // audio was uploaded and is being processed in the server
    SERVER_ERROR: 2, // some error took place when uploading audio
    ISREADY: 3,  // audio was successfully processed and array of chunks is full with 10 elements
    PLAYING: 4, // app is using the chunks to generate the video
    PAUSED: 5, // generation of video is paused
    VIDEO_ERROR: 6 // some error took place in the video generation
    
} as const;

export type AppState = typeof APPSTATE[keyof typeof APPSTATE];


export interface UseWebSocketReturn {
  connect: (sessionId: string) => void;
  disconnect: () => void;
  isConnected: boolean;
  chunks: AudioChunkData[];
  analysis: AudioAnalysisMessage | null;
  status: AudioProcessingStatus | null;
  error: string | null;
  sendGetChunkSignal: () => void;
  sendGetAnalysisSignal: () => void;
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
