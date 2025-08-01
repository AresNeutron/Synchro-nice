import httpx
import asyncio
import websockets
import json
import os
from pprint import pprint # Para imprimir datos JSON de forma legible

# --- Configuración del Servidor ---
SERVER_URL = "http://127.0.0.1:8000"
UPLOAD_ENDPOINT = f"{SERVER_URL}/upload"
CHUNKS_ENDPOINT_TEMPLATE = f"{SERVER_URL}/session/{{session_id}}/chunks"
AUDIO_ENDPOINT_TEMPLATE = f"{SERVER_URL}/audio/{{session_id}}"
WS_ENDPOINT_TEMPLATE = f"ws://127.0.0.1:8000/ws/{{session_id}}"

# --- Configuración del Archivo ---
AUDIO_FILE_PATH = "test_audio.mp3"
DOWNLOADED_AUDIO_PATH = "downloaded_test_audio.mp3"

async def test_all_endpoints():
    """
    Función principal para probar todos los endpoints del servidor.
    """
    print("--- 1. Subiendo archivo de audio ---")
    session_id = await upload_audio_file()
    
    if not session_id:
        return

    print("\n--- 2. Conectando al WebSocket para recibir datos en tiempo real ---")
    await receive_chunks_from_websocket(session_id)
    
    print("\n--- 3. Pidiendo todos los chunks procesados via GET ---")
    await get_all_processed_chunks(session_id)
    
    print("\n--- 4. Descargando el archivo de audio ---")
    await download_audio_file(session_id)

    print("\n--- 5. Limpieza de archivos descargados ---")
    if os.path.exists(DOWNLOADED_AUDIO_PATH):
        os.remove(DOWNLOADED_AUDIO_PATH)
        print(f"Archivo '{DOWNLOADED_AUDIO_PATH}' eliminado.")

async def upload_audio_file():
    """
    Sube un archivo de audio al servidor y devuelve el session_id.
    """
    print(f"Buscando archivo de audio en: {os.path.abspath(AUDIO_FILE_PATH)}")
    
    if not os.path.exists(AUDIO_FILE_PATH):
        print(f"Error: El archivo {AUDIO_FILE_PATH} no se encontró en el directorio actual.")
        return None
    
    try:
        async with httpx.AsyncClient() as client:
            with open(AUDIO_FILE_PATH, "rb") as audio_file:
                files = {"file": (os.path.basename(AUDIO_FILE_PATH), audio_file, "audio/mpeg")}
                response = await client.post(UPLOAD_ENDPOINT, files=files, timeout=30.0)

        response.raise_for_status()
        data = response.json()
        
        print(f"Subida exitosa. Código de estado: {response.status_code}")
        print(f"Session ID recibido: {data.get('session_id')}")
        print(f"Total de chunks a procesar: {data.get('total_chunks')}")
        return data.get("session_id")
        
    except httpx.HTTPStatusError as e:
        print(f"Error de subida. Código de estado: {e.response.status_code}")
        print(f"Cuerpo de la respuesta: {e.response.text}")
    except httpx.RequestError as e:
        print(f"Error de conexión: {e}")
    except Exception as e:
        print(f"Ocurrió un error inesperado: {e}")
    return None

async def receive_chunks_from_websocket(session_id: str):
    """
    Conecta al WebSocket y recibe los chunks de audio en tiempo real.
    """
    ws_url = WS_ENDPOINT_TEMPLATE.format(session_id=session_id)
    print(f"Conectando a {ws_url}...")
    
    try:
        async with websockets.connect(ws_url) as websocket:
            print("Conexión WebSocket establecida. Recibiendo datos...")
            processed_chunks_count = 0
            while True:
                message = await websocket.recv()
                message_json = json.loads(message)
                
                message_type = message_json.get("type")
                message_data = message_json.get("data")
                
                if message_type == "status":
                    status = message_data.get("status")
                    progress = message_data.get("progress") * 100
                    print(f"-> Estado: {status}, Progreso: {progress:.2f}%")
                    if status == "completed":
                        break
                elif message_type == "chunk_data":
                    processed_chunks_count += 1
                    # Opcional: imprimir el timestamp para ver el flujo en tiempo real
                    # print(f"  -> Chunk {processed_chunks_count} recibido (timestamp: {message_data.get('timestamp'):.2f}s)")
                elif message_type == "error":
                    print(f"Error del servidor: {message_data.get('message')}")
                    break
    except websockets.exceptions.ConnectionClosed as e:
        print(f"Conexión WebSocket cerrada: {e}")
    except Exception as e:
        print(f"Error al recibir datos por WebSocket: {e}")

async def get_all_processed_chunks(session_id: str):
    """
    Recupera todos los chunks procesados de un solo golpe.
    """
    chunks_url = CHUNKS_ENDPOINT_TEMPLATE.format(session_id=session_id)
    print(f"Haciendo petición GET a {chunks_url}...")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(chunks_url)
            response.raise_for_status()
            data = response.json()
            
            print(f"Petición exitosa. Recibidos {data.get('total_chunks')} chunks.")
            # Opcional: imprimir los datos completos para una inspección detallada
            # pprint(data.get("chunks"))
    except httpx.HTTPStatusError as e:
        print(f"Error al obtener los chunks. Código de estado: {e.response.status_code}")
    except Exception as e:
        print(f"Ocurrió un error al hacer la petición GET: {e}")

async def download_audio_file(session_id: str):
    """
    Descarga el archivo de audio subido.
    """
    audio_url = AUDIO_ENDPOINT_TEMPLATE.format(session_id=session_id)
    print(f"Descargando archivo de audio desde {audio_url}...")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(audio_url)
            response.raise_for_status()

            with open(DOWNLOADED_AUDIO_PATH, "wb") as f:
                f.write(response.content)
            
            print(f"Archivo de audio descargado exitosamente como '{DOWNLOADED_AUDIO_PATH}'.")
    except httpx.HTTPStatusError as e:
        print(f"Error al descargar el archivo. Código de estado: {e.response.status_code}")
    except Exception as e:
        print(f"Ocurrió un error al descargar el archivo: {e}")

if __name__ == "__main__":
    asyncio.run(test_all_endpoints())
