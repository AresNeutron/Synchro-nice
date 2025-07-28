import { useRef, useEffect, useState, useCallback } from "react";
import { useAppContext } from "../context/AppContext";

export const AudioPlayer = () => {
  const { uploadResponse, handleTimeUpdate, handlePlayStateChange, isPlaying } =
    useAppContext();

  // Extraer fileInfo y sessionId de uploadResponse
  const fileInfo = uploadResponse?.file_info || null;
  const sessionId = uploadResponse?.session_id || null;

  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTimeInternal, setCurrentTimeInternal] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleTimeUpdateInternal = useCallback(() => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTimeInternal(time); // Actualiza estado interno
      handleTimeUpdate(time); // Pasa al contexto
    }
  }, [handleTimeUpdate]);

  useEffect(() => {
    if (fileInfo && sessionId) {
      const audioServerUrl = `http://localhost:8000/audio/${sessionId}`;
      setAudioUrl(audioServerUrl);
      if (audioRef.current) {
        audioRef.current.load(); // Vuelve a cargar el audio si la URL cambia
      }
    } else {
      setAudioUrl(null); // Limpiar si no hay info
    }
  }, [fileInfo, sessionId]);

  // Manejar cuando se carga la metadata del audio
  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  // Manejar play/pause
  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      handlePlayStateChange(false);
    } else {
      audioRef.current
        .play()
        .then(() => {
          handlePlayStateChange(true);
        })
        .catch((error) => {
          console.error("Error reproduciendo audio:", error);
        });
    }
  }, [isPlaying, handlePlayStateChange]);

  // Manejar cambio de volumen
  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  }, []);

  // Manejar cambio de posición en el audio
  const handleSeek = useCallback(
    (newTime: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = newTime;
        setCurrentTimeInternal(newTime);
        handleTimeUpdate(newTime);
      }
    },
    [handleTimeUpdate]
  );

  // Formatear tiempo en mm:ss
  const formatTime = useCallback((time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  // Actualizar estado del reproductor cuando cambie isPlaying externamente
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying && audioRef.current.paused) {
      audioRef.current.play().catch(console.error);
    } else if (!isPlaying && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // Configurar eventos del audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.addEventListener("timeupdate", handleTimeUpdateInternal);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdateInternal);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [handleTimeUpdateInternal, handleLoadedMetadata]);

  if (!fileInfo || !audioUrl) {
    return null;
  }

  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg">
      {/* Audio element oculto */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Información del archivo */}
      <div className="mb-4">
        <h3 className="text-lg font-medium truncate">{fileInfo.filename}</h3>
        <p className="text-sm text-gray-400">
          {formatTime(duration)} • {fileInfo.sample_rate}Hz •{" "}
          {fileInfo.channels} canal{fileInfo.channels > 1 ? "es" : ""}
        </p>
      </div>

      {/* Barra de progreso */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
          <span>{formatTime(currentTimeInternal)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        <input
          type="range"
          min={0}
          max={duration || 0}
          value={currentTimeInternal}
          onChange={(e) => handleSeek(Number(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
        />
      </div>

      {/* Controles */}
      <div className="flex items-center justify-between">
        {/* Botón Play/Pause */}
        <button
          onClick={handlePlayPause}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 transition-colors"
        >
          {isPlaying ? (
            // Icono de pausa
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            // Icono de play
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Control de volumen */}
        <div className="flex items-center space-x-2">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-20 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>
      </div>
    </div>
  );
};
