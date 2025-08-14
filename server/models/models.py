from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json

class AudioChunkData(BaseModel):
    """Estructura de datos para cada chunk de audio procesado"""
    timestamp: float  # Tiempo en segundos desde el inicio
    frequencies: List[float]  # Array de amplitudes por banda de frecuencia (20 bandas aprox)
    amplitude: float  # Volumen general del chunk (0.0 a 1.0)
    brightness: float  # Centroide espectral normalizado - qué tan "brillante" suena
    energy_center: float  # Frecuencia donde está concentrada la energía (Hz)
    is_percussive: bool  # Si detectamos un golpe/percusión en este chunk
    rolloff: float  # Frecuencia por debajo de la cual está el 85% de la energía
    zero_crossing_rate: float  # Tasa de cruces por cero - indica ruido vs tono puro
    spectral_flatness: float # Qué tan "ruidoso" o "tonal" es el sonido (0.0 a 1.0)
    chroma_features: List[float] # Amplitud de cada una de las 12 notas musicales (C, C#, D, etc.)
    beat_strength: float # Cuán fuerte o claro es el pulso rítmico en este chunk (0.0 a 1.0)
    tempo: float # Velocidad de la música en pulsos por minuto (BPM)

# Nuevos modelos para análisis de relaciones

class TransitionAnalysis(BaseModel):
    """Análisis de transiciones entre chunks consecutivos"""
    amplitude_delta: float  # Cambio en amplitud respecto al chunk anterior
    brightness_delta: float  # Cambio en brightness
    beat_strength_delta: float  # Cambio en beat_strength
    frequency_deltas: List[float]  # Cambios en cada banda de frecuencia
    
    # Métricas de suavidad
    transition_smoothness: float  # 0.0 = muy brusco, 1.0 = muy suave
    change_velocity: float  # Qué tan rápido está cambiando la música
    energy_direction: str  # "increasing", "decreasing", "stable"

class TrendAnalysis(BaseModel):
    """Análisis de tendencias en ventana de 25 chunks"""
    amplitude_trend: float  # Pendiente de regresión lineal (-1 a 1)
    brightness_trend: float
    beat_strength_trend: float
    frequency_trends: List[float]  # Tendencias por banda de frecuencia
    
    # Métricas generales
    overall_energy_trend: float  # Tendencia general de energía
    trend_strength: float  # Qué tan fuerte es la tendencia (0.0 a 1.0)
    volatility: float  # Qué tan variable es la música (0.0 = estable, 1.0 = muy variable)

class PatternAnalysis(BaseModel):
    """Análisis de patrones cíclicos detectados"""
    detected_patterns: List[Dict[str, Any]]  # Lista de patrones encontrados
    pattern_strength: float  # Qué tan claros son los patrones (0.0 a 1.0)
    cycle_length: Optional[int]  # Longitud del ciclo principal en chunks
    pattern_confidence: float  # Confianza en la detección (0.0 a 1.0)

class PredictionAnalysis(BaseModel):
    """Predicciones basadas en tendencias actuales"""
    predicted_amplitude: float  # Amplitud predicha para próximos chunks
    predicted_brightness: float
    predicted_beat_strength: float
    predicted_energy_change: str  # "buildup", "drop", "stable", "breakdown"
    
    # Probabilidades de eventos
    drop_probability: float  # Probabilidad de un drop inminente (0.0 a 1.0)
    buildup_probability: float  # Probabilidad de buildup
    break_probability: float  # Probabilidad de break/pausa

class AudioRelationships(BaseModel):
    """Análisis completo de relaciones entre chunks"""
    transitions: TransitionAnalysis
    trends: TrendAnalysis
    patterns: PatternAnalysis
    predictions: PredictionAnalysis
    analysis_window_size: int  # Tamaño de ventana usado para análisis
    buffer_size: int  # Tamaño total del buffer

class AudioAnalysisMessage(BaseModel):
    """Mensaje principal que se envía por WebSocket con análisis completo"""
    current_chunk: AudioChunkData
    relationships: AudioRelationships
    analysis_timestamp: float  # Cuando se hizo este análisis
    chunks_analyzed: int  # Total de chunks analizados hasta ahora

class AudioProcessingStatus(BaseModel):
    """Estado del procesamiento de audio"""
    status: str  # "processing", "completed", "error"
    progress: float  # Porcentaje de completado (0.0 a 1.0)
    total_chunks: int  # Total de chunks que se van a procesar
    processed_chunks: int  # Chunks ya procesados
    duration: float  # Duración total del archivo en segundos

class WebSocketMessage(BaseModel):
    """Mensaje que se envía por WebSocket"""
    type: str  # Tipo de mensaje: "chunk_data", "audio_analysis", "status", "error"
    data: Optional[dict] = None  # Datos del mensaje
    
    def to_json(self) -> str:
        """Convierte el mensaje a JSON para enviar por WebSocket"""
        return json.dumps(self.model_dump())

class AudioFileInfo(BaseModel):
    """Información sobre el archivo de audio subido"""
    filename: str
    duration: float  # Duración en segundos
    sample_rate: int  # Frecuencia de muestreo (ej: 44100 Hz)
    channels: int  # Número de canales (1=mono, 2=estéreo)
    file_path: str  # Ruta donde se guardó el archivo temporalmente