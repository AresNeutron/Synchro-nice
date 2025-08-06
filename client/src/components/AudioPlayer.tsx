import type React from "react";
import { useRef, useEffect, useState } from "react";
import { APPSTATE } from "../types";
import { useAppContext } from "../hooks/useAppContext";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Loader2,
} from "lucide-react";

const AudioPlayer: React.FC = () => {
  const { appState, setAppState, sessionId, isConnected, sendGetChunkSignal } =
    useAppContext();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (appState === APPSTATE.PLAYING) {
        audioRef.current.pause();
        setAppState(APPSTATE.PAUSED);
      } else {
        audioRef.current.play();
        setAppState(APPSTATE.PLAYING);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoading(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number.parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number.parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const skipTime = (seconds: number) => {
    if (audioRef.current) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  useEffect(() => {
    let audioUrl: string | null = null;
    if (sessionId && isConnected && audioRef.current) {
      const fetchAndSetAudio = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(
            `http://localhost:8000/audio/${sessionId}`
          );
          if (!response.ok) {
            throw new Error("Error fetching the audio file");
          }

          const audioBlob = await response.blob();
          audioUrl = URL.createObjectURL(audioBlob);

          if (audioRef.current) {
            audioRef.current.src = audioUrl;
            console.log("Audio URL assigned:", audioUrl);
          }
        } catch (error) {
          console.error("Error fetching audio:", error);
          setAppState(APPSTATE.SERVER_ERROR);
          setIsLoading(false);
        }
      };

      // fill the "chunks" array with 10 chunks
      const getInitialChunks = async () => {
        for (let i = 0; i < 10; i++) {
          sendGetChunkSignal();
        }
      };

      fetchAndSetAudio();
      getInitialChunks();
    }

    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [sessionId, isConnected, setAppState, sendGetChunkSignal]);


  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (appState === APPSTATE.PLAYING) {
      // Llamar inmediatamente la función para sincronizar con la reproducción
      sendGetChunkSignal();

      // Configurar un intervalo para llamar a la función cada 0.2 segundos
      intervalId = setInterval(() => {
        sendGetChunkSignal();
      }, 200); // 200ms = 0.2 segundos
    }

    // Función de limpieza para detener el intervalo cuando el componente se desmonte
    // o el estado de la app cambie (por ejemplo, a PAUSED)
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [appState, sendGetChunkSignal]);

  const isPlaying = appState === APPSTATE.PLAYING;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        onPlay={() => setAppState(APPSTATE.PLAYING)}
        onPause={() => setAppState(APPSTATE.PAUSED)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadStart={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
      />

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            disabled={!isConnected || isLoading}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${progress}%, #374151 ${progress}%, #374151 100%)`,
            }}
          />
        </div>

        <div className="flex justify-between text-sm text-gray-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-4">
        <button
          onClick={() => skipTime(-10)}
          disabled={!isConnected || isLoading}
          className="p-2 rounded-full glass-effect hover:bg-purple-400/20 smooth-transition disabled:opacity-50"
        >
          <SkipBack className="w-5 h-5" />
        </button>

        <button
          onClick={handlePlayPause}
          disabled={!isConnected || isLoading}
          className={`
            p-4 rounded-full smooth-transition disabled:opacity-50
            ${
              isPlaying
                ? "bg-red-500/20 hover:bg-red-500/30 text-red-400"
                : "bg-green-500/20 hover:bg-green-500/30 text-green-400"
            }
          `}
        >
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-1" />
          )}
        </button>

        <button
          onClick={() => skipTime(10)}
          disabled={!isConnected || isLoading}
          className="p-2 rounded-full glass-effect hover:bg-purple-400/20 smooth-transition disabled:opacity-50"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      {/* Volume Control */}
      <div className="flex items-center space-x-3">
        <button
          onClick={toggleMute}
          className="p-2 rounded-full glass-effect hover:bg-purple-400/20 smooth-transition"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-red-400" />
          ) : (
            <Volume2 className="w-5 h-5 text-gray-400" />
          )}
        </button>

        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${
              (isMuted ? 0 : volume) * 100
            }%, #374151 ${(isMuted ? 0 : volume) * 100}%, #374151 100%)`,
          }}
        />
      </div>

      {/* Status */}
      <div className="text-center">
        <div
          className={`
          inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm
          ${
            isPlaying
              ? "bg-green-400/20 text-green-400"
              : appState === APPSTATE.PAUSED
              ? "bg-yellow-400/20 text-yellow-400"
              : "bg-gray-400/20 text-gray-400"
          }
        `}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              isPlaying
                ? "bg-green-400 animate-pulse"
                : appState === APPSTATE.PAUSED
                ? "bg-yellow-400"
                : "bg-gray-400"
            }`}
          ></div>
          <span>
            {isLoading
              ? "Loading..."
              : isPlaying
              ? "Playing"
              : appState === APPSTATE.PAUSED
              ? "Paused"
              : "Ready"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
