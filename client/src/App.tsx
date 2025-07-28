import { useState, useCallback, useEffect } from 'react';
import { AudioUpload } from './components/AudioUpload';
import { AudioPlayer } from './components/AudioPlayer';
import { VisualizerScene } from './components/VisualizerScene';
import { useWebSocket } from './hooks/useWebSocket';
import type { AppState, UploadResponse } from './types';

function App() {
  // Estados principales de la aplicación
  const [appState, setAppState] = useState<AppState>('idle');
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados del reproductor de audio
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Hook de WebSocket
  const { connect, disconnect, isConnected, chunks, status, error: wsError } = useWebSocket();

  // Manejar éxito en la subida de archivo
  const handleUploadSuccess = useCallback((response: UploadResponse) => {
    console.log('Archivo subido exitosamente:', response);
    setUploadResponse(response);
    setAppState('processing');
    setError(null);
    
    // Conectar WebSocket para recibir datos procesados
    connect(response.session_id);
  }, [connect]);

  // Manejar error en la subida
  const handleUploadError = useCallback((errorMessage: string) => {
    console.error('Error en subida:', errorMessage);
    setError(errorMessage);
    setAppState('error');
    setUploadResponse(null);
  }, []);

  // Manejar cambios en el estado de reproducción
  const handlePlayStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    
    // Cambiar estado de la app según reproducción
    if (playing && appState !== 'playing') {
      setAppState('playing');
    } else if (!playing && appState === 'playing') {
      setAppState('paused');
    }
  }, [appState]);

  // Manejar actualización de tiempo del audio
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Resetear aplicación para subir nuevo archivo
  const handleReset = useCallback(() => {
    setAppState('idle');
    setUploadResponse(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setError(null);
    disconnect();
  }, [disconnect]);

  // Monitorear estado del WebSocket
  useEffect(() => {
    if (wsError) {
      setError(`Error de conexión: ${wsError}`);
      setAppState('error');
    }
  }, [wsError]);

  // Monitorear estado del procesamiento
  useEffect(() => {
    if (status) {
      console.log('Estado del procesamiento:', status);
      
      if (status.status === 'completed' && appState === 'processing') {
        // Procesamiento completado, listo para reproducir
        setAppState('paused');
      } else if (status.status === 'error') {
        setError('Error procesando el archivo de audio');
        setAppState('error');
      }
    }
  }, [status, appState]);

  // Renderizar contenido según el estado
  const renderContent = () => {
    switch (appState) {
      case 'idle':
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="mb-8 text-center">
              <h1 className="text-4xl font-bold text-gray-800 mb-4">Synchro-Nice</h1>
              <p className="text-lg text-gray-600">
                Sube tu archivo MP3 y disfruta de visualizaciones sincronizadas
              </p>
            </div>
            
            <AudioUpload
              onUploadSuccess={handleUploadSuccess}
              onUploadError={handleUploadError}
              isUploading={isUploading}
              setIsUploading={setIsUploading}
            />
          </div>
        );

      case 'processing':
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Procesando audio...</h2>
              <p className="text-gray-600 mb-4">
                Analizando frecuencias y generando datos de visualización
              </p>
              
              {status && (
                <div className="bg-gray-200 rounded-full h-2 w-64 mx-auto">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${status.progress * 100}%` }}
                  ></div>
                </div>
              )}
              
              {status && (
                <p className="text-sm text-gray-500 mt-2">
                  {status.processed_chunks} / {status.total_chunks} chunks procesados
                  ({Math.round(status.progress * 100)}%)
                </p>
              )}
            </div>
            
            <button
              onClick={handleReset}
              className="mt-8 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
          </div>
        );

      case 'playing':
      case 'paused':
        return (
          <div className="h-screen flex flex-col">
            {/* Header con información */}
            <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold">Synchro-Nice</h1>
                <p className="text-sm text-gray-300">
                  {chunks.length} chunks recibidos • {isConnected ? 'Conectado' : 'Desconectado'}
                </p>
              </div>
              
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                Nueva canción
              </button>
            </div>

            {/* Área principal con visualizador */}
            <div className="flex-1 relative">
              <VisualizerScene
                chunks={chunks}
                currentTime={currentTime}
                isPlaying={isPlaying}
              />
              
              {/* Overlay con información de debug */}
              <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded text-sm">
                <p>Tiempo: {currentTime.toFixed(1)}s</p>
                <p>Chunks: {chunks.length}</p>
                <p>Estado: {isPlaying ? 'Reproduciendo' : 'Pausado'}</p>
              </div>
            </div>

            {/* Reproductor de audio en la parte inferior */}
            <div className="bg-gray-100 p-4">
              <AudioPlayer
                fileInfo={uploadResponse?.file_info || null}
                onTimeUpdate={handleTimeUpdate}
                onPlayStateChange={handlePlayStateChange}
                isPlaying={isPlaying}
              />
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
              <p className="text-gray-700 mb-6">{error}</p>
              
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Intentar de nuevo
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="App">
      {renderContent()}
    </div>
  );
}

export default App;