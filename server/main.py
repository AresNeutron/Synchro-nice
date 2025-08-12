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
    allow_origins=[
        "http://localhost:5173",
        "https://synchro-nice.vercel.app/",
        "https://synchro-nice-fabio-quevedos-projects.vercel.app/",
        "https://synchro-nice-git-master-fabio-quevedos-projects.vercel.app/",
        "https://synchro-nice-agsdy7xjt-fabio-quevedos-projects.vercel.app/",
        ],
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
            ),
            "queue": asyncio.Queue(maxsize=10), # Cola para los chunks
            "task": None  # La tarea de procesamiento se crea en el WebSocket
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
    print(f"Conexión WebSocket aceptada para la sesión {session_id}")
    
    session_data = current_sessions.get(session_id)

    if not session_data:
        await websocket.send_text(json.dumps({"type": "error", "data": {"message": "Sesión no encontrada"}}))
        await websocket.close()
        return

    status: AudioProcessingStatus = session_data["status"]
    queue: asyncio.Queue = session_data["queue"]

    # Iniciar la tarea de procesamiento si no existe
    if not session_data["task"]:
        task = asyncio.create_task(_processing_task(session_id))
        session_data["task"] = task
        status.status = "processing"
        await websocket.send_text(WebSocketMessage(type="status", data=status.model_dump()).to_json())

    try:
        # Bucle para manejar la comunicación del cliente
        while True:
            # Esperar mensajes del cliente con un timeout
            try:
                message = await asyncio.wait_for(websocket.receive_text(), timeout=1.0)
                message_json = json.loads(message)
                
                if message_json.get("action") == "get_chunk":
                    # Intentar obtener un chunk de la cola
                    chunk_to_send: AudioChunkData = await queue.get()
                    
                    if chunk_to_send == "END_OF_STREAM":
                        status.status = "completed"
                        await websocket.send_text(WebSocketMessage(type="status", data=status.model_dump()).to_json())
                        # Poner de vuelta el marcador para futuras lecturas
                        await queue.put("END_OF_STREAM")
                        break # Salir del bucle
                    else:
                        message = WebSocketMessage(type="chunk_data", data=chunk_to_send.model_dump())
                        await websocket.send_text(message.to_json())
                        
                        # Enviar actualización de estado junto con el chunk
                        await websocket.send_text(WebSocketMessage(type="status", data=status.model_dump()).to_json())
                        
            except asyncio.TimeoutError:
                # Si no hay mensaje, solo chequear el estado de la tarea
                if session_data["task"].done():
                    # Si la tarea terminó y la cola está vacía, salimos
                    if queue.empty():
                        status.status = "completed"
                        await websocket.send_text(WebSocketMessage(type="status", data=status.model_dump()).to_json())
                        break

    except WebSocketDisconnect:
        print(f"WebSocket desconectado para sesión {session_id}")
    except Exception as e:
        print(f"Error inesperado en WebSocket para la sesión {session_id}: {e}")
        await websocket.send_text(WebSocketMessage(type="error", data={"message": str(e)}).to_json())
    finally:
        await _cleanup_session(session_id)


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



async def _processing_task(session_id: str):
    """Tarea en segundo plano para procesar el audio y llenar la cola."""
    print(f"Tarea de procesamiento iniciada para la sesión: {session_id}")
    session_data = current_sessions.get(session_id)
    
    if not session_data:
        print("NO HAY DATOS DE SESIÓN")
        return
        
    audio_data = session_data["audio_data"]
    sample_rate = session_data["sample_rate"]
    status: AudioProcessingStatus = session_data["status"]
    queue: asyncio.Queue = session_data["queue"]
    
    try:
        chunk_generator = audio_processor.process_chunks(audio_data, sample_rate)
        
        # Bucle para consumir el generador y llenar la cola
        for chunk_data in chunk_generator:
            # Guardar el chunk en almacenamiento permanente
            processed_audio_data[session_id].append(chunk_data)
            
            # Poner el chunk en la cola (bloqueará si la cola está llena)
            await queue.put(chunk_data)
            
            # Actualizar progreso
            status.processed_chunks += 1
            status.progress = status.processed_chunks / status.total_chunks
            
            # Pequeña pausa para no saturar la CPU
            await asyncio.sleep(0.001)

        # Marcar la cola como terminada cuando el generador se agota
        await queue.put("END_OF_STREAM")
        
        print(f"Procesamiento completo para la sesión: {session_id}")

    except asyncio.CancelledError:
        print(f"Tarea de procesamiento cancelada para la sesión: {session_id}")
        raise # Propagar la cancelación
    except Exception as e:
        print(f"Error en la tarea de procesamiento de la sesión {session_id}: {e}")
        await queue.put({"type": "error", "data": {"message": str(e)}})


async def _cleanup_session(session_id: str):
    """Limpia la sesión y la tarea en segundo plano."""
    if session_id in current_sessions:
        task = current_sessions[session_id].get("task")
        if task and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        
        # Eliminar los archivos temporales de la sesión
        session_file_dir = os.path.join(TEMP_BASE_DIR, session_id)
        if os.path.exists(session_file_dir):
            for file in os.listdir(session_file_dir):
                os.remove(os.path.join(session_file_dir, file))
            os.rmdir(session_file_dir)
            print(f"Directorio temporal '{session_file_dir}' eliminado.")
            
        del current_sessions[session_id]
        if session_id in processed_audio_data:
            del processed_audio_data[session_id]
        print(f"Sesión '{session_id}' limpiada.")