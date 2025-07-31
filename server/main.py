from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
import asyncio
import os
import json
import uuid
from audio_processor import AudioProcessor
from models.models import WebSocketMessage, AudioProcessingStatus, AudioChunkData
from typing import List, Dict

app = FastAPI()

# Permitir CORS para el frontend en desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instancia global del procesador de audio
audio_processor = AudioProcessor(chunk_duration=0.2)

# Almacenamiento temporal de datos procesados
processed_audio_data: Dict[str, List[AudioChunkData]] = {}  # {session_id: [AudioChunkData, ...]}
current_sessions = {}  # {session_id: {"file_info": ..., "status": ...}}

TEMP_BASE_DIR = os.path.join("audio_uploads")
os.makedirs(TEMP_BASE_DIR, exist_ok=True) # Asegurarse de que el directorio base exista

@app.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    """Endpoint para subir archivo de audio MP3"""
    
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
        
        # Guardar información de la sesión
        current_sessions[session_id] = {
            "file_info": file_info,
            "audio_data": audio_data,
            "sample_rate": sample_rate,
            "status": AudioProcessingStatus(
                status="ready",
                progress=0.0,
                total_chunks=total_chunks,
                processed_chunks=0,
                duration=file_info.duration
            )
        }
        
        # Inicializar almacenamiento de datos procesados
        processed_audio_data[session_id] = []
        
        return {
            "session_id": session_id,
            "file_info": file_info.model_dump(),
            "total_chunks": total_chunks
        }
        
    except Exception:
        pass

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket para enviar datos de audio procesados en tiempo real"""
    
    await websocket.accept()
    
    # Verificar que la sesión existe
    if session_id not in current_sessions:
        await websocket.send_text(json.dumps({
            "type": "error",
            "data": {"message": "Sesión no encontrada"}
        }))
        await websocket.close()
        return
    
    try:
        # Obtener datos de la sesión
        session_data = current_sessions[session_id]
        audio_data = session_data["audio_data"]
        sample_rate = session_data["sample_rate"]
        status: AudioProcessingStatus = session_data["status"]
        
        # Actualizar estado a "procesando"
        status.status = "processing"
        
        # Enviar estado inicial
        await websocket.send_text(
            WebSocketMessage(
                type="status",
                data=status.model_dump()
            ).to_json()
        )
        
        # Buffer para almacenar chunks procesados
        chunk_buffer: List[AudioChunkData] = []
        buffer_size = 10  # Procesar 10 chunks adelantados
        
        # Procesar audio en chunks
        chunk_generator = audio_processor.process_chunks(audio_data, sample_rate)
        
        for chunk_data in chunk_generator:
            # Agregar chunk al buffer
            chunk_buffer.append(chunk_data)
            
            # También guardarlo en almacenamiento permanente
            processed_audio_data[session_id].append(chunk_data)
            
            # Actualizar progreso
            status.processed_chunks += 1
            status.progress = status.processed_chunks / status.total_chunks
            
            # Si tenemos suficientes chunks en buffer o es el último, enviar
            if len(chunk_buffer) >= buffer_size or status.processed_chunks == status.total_chunks:
                
                # Enviar chunks del buffer
                for buffered_chunk in chunk_buffer:
                    message = WebSocketMessage(
                        type="chunk_data",
                        data=buffered_chunk.model_dump()
                    )
                    await websocket.send_text(message.to_json())
                    
                    # Pequeña pausa para no saturar el WebSocket
                    await asyncio.sleep(0.01)
                
                # Limpiar buffer
                chunk_buffer = []
                
                # Enviar actualización de estado
                await websocket.send_text(
                    WebSocketMessage(
                        type="status",
                        data=status.model_dump()
                    ).to_json()
                )
        
        # Marcar como completado
        status.status = "completed"
        await websocket.send_text(
            WebSocketMessage(
                type="status",
                data=status.model_dump()
            ).to_json()
        )
        
    except WebSocketDisconnect:
        print(f"WebSocket desconectado para sesión {session_id}")
    except Exception as e:
        # Enviar error por WebSocket
        await websocket.send_text(
            WebSocketMessage(
                type="error",
                data={"message": str(e)}
            ).to_json()
        )


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
