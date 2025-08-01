// src/App.tsx
import { useAppContext } from "./hooks/useAppContext"; // Importa el hook del contexto
import { AudioUpload } from "./components/AudioUpload";
import { AudioPlayer } from "./components/AudioPlayer";
import { VisualizerScene } from "./components/VisualizerScene";

function App() {
  const {
    appState,
    error,
    isPlaying,
    currentTime,
    isConnected,
    chunks,
    wsStatus,
    handleReset,
  } = useAppContext(); // ¡Todo viene del contexto!

  // El resto de la lógica (renderContent) permanece igual, pero usa las variables del contexto

  const renderContent = () => {
    switch (appState) {
      case "idle":
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="mb-8 text-center">
              <h1 className="text-4xl font-bold text-gray-800 mb-4">
                Synchro-Nice
              </h1>
              <p className="text-lg text-gray-600">
                Sube tu archivo MP3 y disfruta de visualizaciones sincronizadas
              </p>
            </div>

            <AudioUpload />
          </div>
        );

      case "processing":
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Procesando audio...
              </h2>
              <p className="text-gray-600 mb-4">
                Analizando frecuencias y generando datos de visualización
              </p>

              {wsStatus && ( // Usa wsStatus del contexto
                <div className="bg-gray-200 rounded-full h-2 w-64 mx-auto">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${wsStatus.progress * 100}%` }}
                  ></div>
                </div>
              )}

              {wsStatus && ( // Usa wsStatus del contexto
                <p className="text-sm text-gray-500 mt-2">
                  {wsStatus.processed_chunks} / {wsStatus.total_chunks} chunks
                  procesados ({Math.round(wsStatus.progress * 100)}%)
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

      case "playing":
      case "paused":
        return (
          <div className="h-screen flex flex-col">
            {/* Header con información */}
            <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold">Synchro-Nice</h1>
                <p className="text-sm text-gray-300">
                  {chunks.length} chunks recibidos •{" "}
                  {isConnected ? "Conectado" : "Desconectado"}
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
              <VisualizerScene />

              {/* Overlay con información de debug */}
              <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded text-sm">
                <p>Tiempo: {currentTime.toFixed(1)}s</p>
                <p>Chunks: {chunks.length}</p>
                <p>Estado: {isPlaying ? "Reproduciendo" : "Pausado"}</p>
              </div>
            </div>

            {/* Reproductor de audio en la parte inferior */}
            <div className="bg-gray-100 p-4">
              <AudioPlayer />
            </div>
          </div>
        );

      case "error":
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
              <p className="text-gray-700 mb-6">{error}</p>{" "}
              {/* Usa el error unificado del contexto */}
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

  return <div className="App">{renderContent()}</div>;
}

export default App;
