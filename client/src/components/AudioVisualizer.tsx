import React, { useRef, useEffect, useCallback } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { APPSTATE, initialVisualizerState, type AudioChunkData } from '../types';

const Visualizer: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { chunks, isConnected, getInitialChunks, sendGetChunkSignal, appState } = useAppContext();

    const visualizerStateRef = useRef<AudioChunkData>(initialVisualizerState);
    const lastChunkTimeRef = useRef<number>(0);

    const lerp = useCallback((start: number, end: number, t: number): number => {
        return start * (1 - t) + end * t;
    }, []);

    const animate = useCallback((timestamp: number) => {
        if (appState !== APPSTATE.PLAYING) {
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = canvas;
        const state = visualizerStateRef.current;

        // Drawing and interpolation logic
        if (chunks.length > 1) {
            const currentChunk: AudioChunkData = chunks[0];
            const nextChunk: AudioChunkData = chunks[1];
            
            // Calculate interpolation progress based on time
            const timeSinceLastChunk = timestamp - lastChunkTimeRef.current;
            const progress = Math.min(1, timeSinceLastChunk / 200); // 200ms per chunk

            Object.keys(initialVisualizerState).forEach(key => {
                const stateKey = key as keyof AudioChunkData;
                if (typeof initialVisualizerState[stateKey] === 'number') {
                    (visualizerStateRef.current[stateKey] as number) = lerp(
                        (currentChunk[stateKey] as number),
                        (nextChunk[stateKey] as number),
                        progress
                    );
                }
            });

            // Clear the canvas in a controlled way
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, width, height);

            // ... (rest of the drawing logic)
            if (currentChunk.is_percussive) {
                const flashEffect = Math.sin(timestamp * 0.01) * 0.5 + 0.5;
                ctx.fillStyle = `rgba(255, 255, 255, ${flashEffect * state.beat_strength})`;
                ctx.fillRect(0, 0, width, height);
            }
            
            const radius = state.amplitude * 200 + 10;
            const hue = state.brightness * 360;
            ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, radius, 0, 2 * Math.PI);
            ctx.fill();

            const barWidth = width / currentChunk.frequencies.length;
            currentChunk.frequencies.forEach((freq, i) => {
                const barHeight = freq * height * 0.5;
                const barX = i * barWidth;
                const barY = height - barHeight;
                ctx.fillStyle = `rgba(0, 255, 255, ${freq})`;
                ctx.fillRect(barX, barY, barWidth, barHeight);
            });

            const innerRadius = 150;
            const outerRadius = 250;
            state.chroma_features.forEach((chroma, i) => {
                const startAngle = (Math.PI * 2 / 12) * i;
                const endAngle = (Math.PI * 2 / 12) * (i + 1);

                ctx.beginPath();
                ctx.arc(width / 2, height / 2, outerRadius, startAngle, endAngle);
                ctx.arc(width / 2, height / 2, innerRadius, endAngle, startAngle, true);
                ctx.closePath();
                ctx.fillStyle = `rgba(255, 105, 180, ${chroma})`;
                ctx.fill();
            });

        }
        
        requestAnimationFrame(animate);
    }, [chunks, lerp, appState]);

    useEffect(() => {
        if (!isConnected) return;

        // We only start the animation and chunk sending when appState is PLAYING
        let animationId: number;
        let chunkInterval: NodeJS.Timeout | null = null;
        
        if (appState === APPSTATE.PLAYING) {
            if (chunks.length === 0) {
                getInitialChunks();
            }

            animationId = requestAnimationFrame(animate);
            lastChunkTimeRef.current = performance.now();

            chunkInterval = setInterval(() => {
                sendGetChunkSignal();
                lastChunkTimeRef.current = performance.now();
            }, 200);
        }

        return () => {
            if (animationId) cancelAnimationFrame(animationId);
            if (chunkInterval) clearInterval(chunkInterval);
        };
    }, [isConnected, appState, animate, chunks, getInitialChunks, sendGetChunkSignal]);

    return (
        <canvas
            ref={canvasRef}
            width={800}
            height={600}
            style={{ border: '1px solid #333', background: '#000' }}
        />
    );
};

export default Visualizer;