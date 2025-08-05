import React, { useRef, useEffect } from 'react';
import { APPSTATE } from '../types';
import { useAppContext } from '../hooks/useAppContext';

const AudioPlayer: React.FC = () => {
  const { appState, setAppState, sessionId, isConnected } = useAppContext();
  const audioRef = useRef<HTMLAudioElement>(null);
  
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

   useEffect(() => {
    let audioUrl: string | null = null;
    if (sessionId && isConnected && audioRef.current) {
      const fetchAndSetAudio = async () => {
        try {
          const response = await fetch(`http://localhost:8000/audio/${sessionId}`);
          if (!response.ok) {
            throw new Error('Error al obtener el archivo de audio');
          }
          console.log(response)

          const audioBlob = await response.blob();
          
          audioUrl = URL.createObjectURL(audioBlob);
          
          if (audioRef.current) {
            audioRef.current.src = audioUrl;
            console.log("URL de audio asignada:", audioUrl);
          }

        } catch (error) {
          console.error('Error fetching audio:', error);
        }
      };
      
      fetchAndSetAudio();
    }
  }, [sessionId, isConnected]);

  const isPlaying = appState === APPSTATE.PLAYING;

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <audio ref={audioRef} onPlay={() => setAppState(APPSTATE.PLAYING)} onPause={() => setAppState(APPSTATE.PAUSED)} />
      
      <button 
        onClick={handlePlayPause}
        disabled={!isConnected}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: 'pointer',
          backgroundColor: isPlaying ? 'red' : 'green',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          opacity: (!isConnected) ? 0.5 : 1,
        }}
      >
        {isPlaying ? 'Pausar' : 'Reproducir'}
      </button>

        <div style={{ marginTop: '20px' }}>
          <p>Progreso del audio:</p>
          <progress 
            value={audioRef.current?.currentTime || 0} 
            max={audioRef.current?.duration || 0}
            style={{ width: '80%', height: '20px' }}
          />
        </div>

      <p style={{ marginTop: '10px', color: 'white' }}>Estado actual: {
        Object.keys(APPSTATE).find(key => APPSTATE[key as keyof typeof APPSTATE] === appState)
      }</p>
    </div>
  );
};

export default AudioPlayer;