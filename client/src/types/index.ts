export interface AudioChunkData {
  timestamp: number;
  frequencies: number[]; // 20 bandas de frecuencia
  amplitude: number; // 0.0 a 1.0
  brightness: number; // Centroide espectral normalizado
  energy_center: number; // Frecuencia donde está la energía (Hz)
  is_percussive: boolean; // Si hay percusión en este chunk
  rolloff: number; // Rolloff espectral
  zero_crossing_rate: number; // Tasa de cruces por cero
  spectral_flatness: number; // Qué tan "ruidoso" o "tonal" es el sonido (0.0 a 1.0)
  chroma_features: number[]; // Amplitud de cada una de las 12 notas musicales
  beat_strength: number; // Cuán fuerte o claro es el pulso rítmico
  tempo: number; // Velocidad de la música en pulsos por minuto (BPM)
}

export interface AudioProcessingStatus {
  status: 'processing' | 'completed' | 'error' | 'ready';
  progress: number; // 0.0 a 1.0
  total_chunks: number;
  processed_chunks: number;
  duration: number; // Duración total en segundos
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

// Configuración del visualizador
export interface VisualizerConfig {
  numParticles: number;
  bassRange: [number, number]; // Índices de frecuencias graves
  midRange: [number, number]; // Índices de frecuencias medias
  highRange: [number, number]; // Índices de frecuencias agudas
}


export interface UseWebSocketReturn {
  connect: (sessionId: string) => void;
  disconnect: () => void;
  isConnected: boolean;
  chunks: AudioChunkData[];
  status: AudioProcessingStatus | null;
  error: string | null;
}
