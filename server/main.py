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
    WebSocketMessage, AudioProcessingStatus, AudioChunkData,
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
current_sessions = {}  # {session_id: {"file_info": ..., "status": ..., "analyzer": ...}}

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
        
        # Crear analizador para esta sesión
        analyzer = AudioAnalyzer(analysis_window_size=25)  # 5 segundos de ventana
        
        # Guardar información de la sesión
        current_sessions[session_id] = {
            "file_info": file_info,
            "audio_data": audio_data,
            "sample_rate": sample_rate,
            "analyzer": analyzer,
            "status": AudioProcessingStatus(
                status="ready",
                progress=0.0,
                total_chunks=total_chunks,
                processed_chunks=0,
                duration=file_info.duration
            ),
            "chunk_queue": asyncio.Queue(maxsize=50),  # Cola para chunks individuales
            "analysis_queue": asyncio.Queue(maxsize=10),  # Cola para análisis completos
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
    """WebSocket para enviar datos de audio procesados y análisis de relaciones"""
    await websocket.accept()
    print(f"Conexión WebSocket aceptada para la sesión {session_id}")
    
    session_data = current_sessions.get(session_id)

    if not session_data:
        await websocket.send_text(json.dumps({"type": "error", "data": {"message": "Sesión no encontrada"}}))
        await websocket.close()
        return

    status: AudioProcessingStatus = session_data["status"]
    chunk_queue: asyncio.Queue = session_data["chunk_queue"]
    analysis_queue: asyncio.Queue = session_data["analysis_queue"]

    # Iniciar la tarea de procesamiento si no existe
    if not session_data["task"]:
        task = asyncio.create_task(_processing_task(session_id))
        session_data["task"] = task
        status.status = "processing"
        await websocket.send_text(WebSocketMessage(type="status", data=status.model_dump()).to_json())

    try:
        # Bucle para manejar la comunicación del cliente
        while True:
            try:
                # Esperar mensajes del cliente con un timeout
                message = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                message_json = json.loads(message)
                
                if message_json.get("action") == "get_chunk":
                    # Intentar obtener un chunk individual de la cola
                    try:
                        chunk_to_send: AudioChunkData = chunk_queue.get_nowait()
                        
                        if chunk_to_send == "END_OF_STREAM":
                            status.status = "completed"
                            await websocket.send_text(WebSocketMessage(type="status", data=status.model_dump()).to_json())
                            # Poner de vuelta el marcador para futuras lecturas
                            await chunk_queue.put("END_OF_STREAM")
                            break
                        else:
                            message = WebSocketMessage(type="chunk_data", data=chunk_to_send.model_dump())
                            await websocket.send_text(message.to_json())
                    except asyncio.QueueEmpty:
                        # No hay chunks disponibles por ahora
                        pass
                
                elif message_json.get("action") == "get_analysis":
                    # Intentar obtener análisis completo de la cola
                    try:
                        analysis_to_send: AudioAnalysisMessage = analysis_queue.get_nowait()
                        
                        if analysis_to_send == "END_OF_STREAM":
                            status.status = "completed"
                            await websocket.send_text(WebSocketMessage(type="status", data=status.model_dump()).to_json())
                            # Poner de vuelta el marcador para futuras lecturas
                            await analysis_queue.put("END_OF_STREAM")
                            break
                        else:
                            message = WebSocketMessage(type="audio_analysis", data=analysis_to_send.model_dump())
                            await websocket.send_text(message.to_json())
                            
                            # Enviar actualización de estado junto con el análisis
                            await websocket.send_text(WebSocketMessage(type="status", data=status.model_dump()).to_json())
                    except asyncio.QueueEmpty:
                        # No hay análisis disponibles por ahora
                        pass
                        
            except asyncio.TimeoutError:
                # Si no hay mensaje del cliente, chequear si hay datos nuevos disponibles
                
                # Enviar chunks individuales si están disponibles
                try:
                    while not chunk_queue.empty():
                        chunk_to_send: AudioChunkData = chunk_queue.get_nowait()
                        
                        if chunk_to_send == "END_OF_STREAM":
                            status.status = "completed"
                            await websocket.send_text(WebSocketMessage(type="status", data=status.model_dump()).to_json())
                            await chunk_queue.put("END_OF_STREAM")  # Poner de vuelta
                            break
                        else:
                            message = WebSocketMessage(type="chunk_data", data=chunk_to_send.model_dump())
                            await websocket.send_text(message.to_json())
                            
                except asyncio.QueueEmpty:
                    pass
                
                # Enviar análisis completos si están disponibles
                try:
                    while not analysis_queue.empty():
                        analysis_to_send: AudioAnalysisMessage = analysis_queue.get_nowait()
                        
                        if analysis_to_send == "END_OF_STREAM":
                            status.status = "completed"
                            await websocket.send_text(WebSocketMessage(type="status", data=status.model_dump()).to_json())
                            await analysis_queue.put("END_OF_STREAM")  # Poner de vuelta
                            break
                        else:
                            message = WebSocketMessage(type="audio_analysis", data=analysis_to_send.model_dump())
                            await websocket.send_text(message.to_json())
                            
                            # Enviar actualización de estado
                            await websocket.send_text(WebSocketMessage(type="status", data=status.model_dump()).to_json())
                            
                except asyncio.QueueEmpty:
                    pass
                
                # Chequear si la tarea de procesamiento terminó
                if session_data["task"].done():
                    if chunk_queue.empty() and analysis_queue.empty():
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
    """Tarea en segundo plano para procesar el audio, hacer análisis y llenar las colas."""
    print(f"Tarea de procesamiento iniciada para la sesión: {session_id}")
    session_data = current_sessions.get(session_id)
    
    if not session_data:
        print("NO HAY DATOS DE SESIÓN")
        return
        
    audio_data = session_data["audio_data"]
    sample_rate = session_data["sample_rate"]
    status: AudioProcessingStatus = session_data["status"]
    chunk_queue: asyncio.Queue = session_data["chunk_queue"]
    analysis_queue: asyncio.Queue = session_data["analysis_queue"]
    analyzer: AudioAnalyzer = session_data["analyzer"]
    
    try:
        chunk_generator = audio_processor.process_chunks(audio_data, sample_rate)
        
        chunk_counter = 0
        
        # Bucle para consumir el generador y llenar las colas
        for chunk_data in chunk_generator:
            # Guardar el chunk en almacenamiento permanente
            processed_audio_data[session_id].append(chunk_data)
            
            # Añadir chunk al analizador
            analyzer.add_chunk(chunk_data)
            
            # Poner el chunk individual en la cola
            await chunk_queue.put(chunk_data)
            
            # Cada 5 chunks (1 segundo), hacer análisis completo
            chunk_counter += 1
            if chunk_counter % 5 == 0:
                relationships = analyzer.analyze_relationships()
                
                if relationships:
                    # Crear mensaje de análisis completo
                    analysis_message = AudioAnalysisMessage(
                        current_chunk=chunk_data,
                        relationships=relationships,
                        analysis_timestamp=chunk_data.timestamp,
                        chunks_analyzed=chunk_counter
                    )
                    
                    # Poner el análisis en su cola
                    await analysis_queue.put(analysis_message)
                    
                    print(f"Análisis completo generado en el chunk {chunk_counter} (timestamp: {chunk_data.timestamp:.2f}s)")
            
            # Actualizar progreso
            status.processed_chunks += 1
            status.progress = status.processed_chunks / status.total_chunks
            
            # Pequeña pausa para no saturar la CPU
            await asyncio.sleep(0.001)

        # Hacer análisis final si quedan chunks sin analizar
        if chunk_counter % 5 != 0:
            relationships = analyzer.analyze_relationships()
            
            if relationships and chunk_counter > 0:
                # Usar el último chunk procesado
                last_chunk = processed_audio_data[session_id][-1]
                analysis_message = AudioAnalysisMessage(
                    current_chunk=last_chunk,
                    relationships=relationships,
                    analysis_timestamp=last_chunk.timestamp,
                    chunks_analyzed=chunk_counter
                )
                
                await analysis_queue.put(analysis_message)
                print(f"Análisis final generado con {chunk_counter} chunks totales")

        # Marcar las colas como terminadas
        await chunk_queue.put("END_OF_STREAM")
        await analysis_queue.put("END_OF_STREAM")
        
        print(f"Procesamiento completo para la sesión: {session_id}")
        print(f"Total de chunks procesados: {chunk_counter}")
        print(f"Análisis generados: {chunk_counter // 5 + (1 if chunk_counter % 5 != 0 else 0)}")

    except asyncio.CancelledError:
        print(f"Tarea de procesamiento cancelada para la sesión: {session_id}")
        raise # Propagar la cancelación
    except Exception as e:
        print(f"Error en la tarea de procesamiento de la sesión {session_id}: {e}")
        await chunk_queue.put({"type": "error", "data": {"message": str(e)}})
        await analysis_queue.put({"type": "error", "data": {"message": str(e)}})


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