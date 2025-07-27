from pydantic import BaseModel
from typing import List, Optional
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

class AudioProcessingStatus(BaseModel):
    """Estado del procesamiento de audio"""
    status: str  # "processing", "completed", "error"
    progress: float  # Porcentaje de completado (0.0 a 1.0)
    total_chunks: int  # Total de chunks que se van a procesar
    processed_chunks: int  # Chunks ya procesados
    duration: float  # Duración total del archivo en segundos

class WebSocketMessage(BaseModel):
    """Mensaje que se envía por WebSocket"""
    type: str  # Tipo de mensaje: "chunk_data", "status", "error"
    data: Optional[dict] = None  # Datos del mensaje (puede ser AudioChunkData o AudioProcessingStatus)
    
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