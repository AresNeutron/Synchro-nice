from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
import asyncio
import os
import json
import uuid
from services.audio_processor import AudioProcessor
from services.audio_analyzer import AudioAnalyzer
from models.models import (
    AudioChunkData,
    AudioAnalysisMessage
)
from typing import List, Dict

app = FastAPI()

# Permitir CORS para el frontend en desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://synchro-nice.vercel.app/",
        "https://vercel.com/fabio-quevedos-projects/synchro-nice/46dWfCamhEtyM2BWA4k1vQMhFFTL",
        "https://synchro-nice-fabio-quevedos-projects.vercel.app/",
        "https://synchro-nice-git-master-fabio-quevedos-projects.vercel.app/",
        ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instancia global del procesador de audio
audio_processor = AudioProcessor(chunk_duration=0.2)

# Almacenamiento temporal de datos procesados
processed_audio_data: Dict[str, List[AudioChunkData]] = {}  # {session_id: [AudioChunkData, ...]}
processed_analysis_data: Dict[str, List[AudioAnalysisMessage]] = {}  # {session_id: [AudioAnalysisMessage, ...]}
current_sessions = {}  # {session_id: {"file_info": ..., "status": ..., "analyzer": ...}}

TEMP_BASE_DIR = os.path.join("audio_uploads")
os.makedirs(TEMP_BASE_DIR, exist_ok=True) # Asegurarse de que el directorio base exista

@app.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    """Endpoint para subir archivo de audio MP3 y procesar todos los chunks inmediatamente"""
    
    if not file.filename.lower().endswith('.mp3'):
        return {"error": "Solo se permiten archivos MP3"}
    
    session_id = str(uuid.uuid4())

    session_file_dir = os.path.join(TEMP_BASE_DIR, session_id)
    os.makedirs(session_file_dir, exist_ok=True)

    file_path = os.path.join(session_file_dir, file.filename)

    try:
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        print(f"Archivo '{file.filename}' guardado en: {file_path}") # Para depuración
        
        # Cargar información del archivo
        file_info, audio_data, sample_rate = audio_processor.load_audio(file_path)
        
        # Calcular número total de chunks
        chunk_samples = int(audio_processor.chunk_duration * sample_rate)
        total_chunks = len(audio_data) // chunk_samples + (1 if len(audio_data) % chunk_samples else 0)
        
        print(f"Procesando {total_chunks} chunks para sesión {session_id}...")
        
        # Crear analizador para esta sesión
        analyzer = AudioAnalyzer(analysis_window_size=25)
        
        # Procesar TODOS los chunks inmediatamente
        all_chunks = []
        all_analysis = []
        
        chunk_generator = audio_processor.process_chunks(audio_data, sample_rate)
        chunk_counter = 0
        
        for chunk_data in chunk_generator:
            # Guardar el chunk
            all_chunks.append(chunk_data)
            
            # Añadir chunk al analizador
            analyzer.add_chunk(chunk_data)
            
            # Cada 5 chunks (1 segundo), hacer análisis completo
            chunk_counter += 1
            if chunk_counter % 5 == 0:
                relationships = analyzer.analyze_relationships()
                
                if relationships:
                    analysis_message = AudioAnalysisMessage(
                        current_chunk=chunk_data,
                        relationships=relationships,
                        analysis_timestamp=chunk_data.timestamp,
                        chunks_analyzed=chunk_counter
                    )
                    all_analysis.append(analysis_message)
        
        # Análisis final si quedan chunks sin analizar
        if chunk_counter % 5 != 0:
            relationships = analyzer.analyze_relationships()
            if relationships and chunk_counter > 0:
                analysis_message = AudioAnalysisMessage(
                    current_chunk=all_chunks[-1],
                    relationships=relationships,
                    analysis_timestamp=all_chunks[-1].timestamp,
                    chunks_analyzed=chunk_counter
                )
                all_analysis.append(analysis_message)
        
        # Guardar datos procesados para acceso posterior si es necesario
        processed_audio_data[session_id] = all_chunks
        processed_analysis_data[session_id] = all_analysis
        
        print(f"Procesamiento completo: {chunk_counter} chunks, {len(all_analysis)} análisis")
        
        return {
            "session_id": session_id,
            "file_info": file_info.model_dump(),
            "total_chunks": total_chunks,
            "chunks": [chunk.model_dump() for chunk in all_chunks],
            "analysis": [analysis.model_dump() for analysis in all_analysis]
        }
        
    except Exception as e:
        print(f"Error procesando archivo: {e}")
        return {"error": f"Error procesando archivo: {str(e)}"}


@app.get("/")
async def root():
    return {"message": "Synchro-Nice Backend API"}

@app.get("/session/{session_id}/chunks")
async def get_processed_chunks(session_id: str):
    """Endpoint para obtener chunks ya procesados (útil para implementar pausa/retroceso)"""
    
    if session_id not in processed_audio_data:
        return {"error": "Sesión no encontrada"}
    
    chunks = processed_audio_data[session_id]
    return {
        "session_id": session_id,
        "total_chunks": len(chunks),
        "chunks": [chunk.model_dump() for chunk in chunks]
    }

@app.get("/audio/{session_id}")
async def get_audio_file(session_id: str):
    """Endpoint para servir el archivo de audio temporal por su session_id."""
    if session_id not in current_sessions:
        return Response(status_code=status.HTTP_400_BAD_REQUEST)

    file_path = current_sessions[session_id]["file_info"].file_path
    if not os.path.exists(file_path):
        return Response(status_code=status.HTTP_404_NOT_FOUND)

    return FileResponse(path=file_path, media_type="audio/mpeg", filename=os.path.basename(file_path))

