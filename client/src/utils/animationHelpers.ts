import * as THREE from "three";
import type { AudioChunkData, AudioAnalysisMessage } from "../types";

/**
 * Smooth interpolation between audio chunks for 60fps animation
 */
export function interpolateAudioData(
  currentChunk: AudioChunkData | null,
  nextChunk: AudioChunkData | null,
  alpha: number // 0 to 1, interpolation factor
): AudioChunkData {
  if (!currentChunk && !nextChunk) {
    return createEmptyChunk();
  }
  
  if (!nextChunk) return currentChunk!;
  if (!currentChunk) return nextChunk!;
  
  // Linear interpolation for numerical values
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  
  // Interpolate frequency array
  const frequencies = currentChunk.frequencies.map((freq, i) => 
    lerp(freq, nextChunk.frequencies[i] || 0, alpha)
  );
  
  // Interpolate chroma features
  const chroma_features = currentChunk.chroma_features.map((chroma, i) =>
    lerp(chroma, nextChunk.chroma_features[i] || 0, alpha)
  );
  
  return {
    timestamp: lerp(currentChunk.timestamp, nextChunk.timestamp, alpha),
    frequencies,
    amplitude: lerp(currentChunk.amplitude, nextChunk.amplitude, alpha),
    brightness: lerp(currentChunk.brightness, nextChunk.brightness, alpha),
    energy_center: lerp(currentChunk.energy_center, nextChunk.energy_center, alpha),
    is_percussive: alpha < 0.5 ? currentChunk.is_percussive : nextChunk.is_percussive,
    rolloff: lerp(currentChunk.rolloff, nextChunk.rolloff, alpha),
    zero_crossing_rate: lerp(currentChunk.zero_crossing_rate, nextChunk.zero_crossing_rate, alpha),
    spectral_flatness: lerp(currentChunk.spectral_flatness, nextChunk.spectral_flatness, alpha),
    chroma_features,
    beat_strength: lerp(currentChunk.beat_strength, nextChunk.beat_strength, alpha),
    tempo: lerp(currentChunk.tempo, nextChunk.tempo, alpha)
  };
}

/**
 * Creates an empty audio chunk for fallback
 */
export function createEmptyChunk(): AudioChunkData {
  return {
    timestamp: 0,
    frequencies: Array(20).fill(0),
    amplitude: 0,
    brightness: 0,
    energy_center: 0,
    is_percussive: false,
    rolloff: 0,
    zero_crossing_rate: 0,
    spectral_flatness: 0.5,
    chroma_features: Array(12).fill(0),
    beat_strength: 0,
    tempo: 120
  };
}

/**
 * Calculates smooth animation timing based on tempo and beat
 */
export function getAnimationTiming(chunk: AudioChunkData): {
  baseSpeed: number;
  pulseIntensity: number;
  rhythmPhase: number;
} {
  const tempoNormalized = chunk.tempo / 120; // Normalize around 120 BPM
  const baseSpeed = 0.5 + tempoNormalized * 0.5; // 0.5 to 1.0 speed range
  
  // Beat-driven pulsing
  const pulseIntensity = chunk.beat_strength * (chunk.is_percussive ? 1.5 : 1);
  
  // Calculate rhythm phase for synchronized animations
  const beatsPerSecond = chunk.tempo / 60;
  const rhythmPhase = (chunk.timestamp * beatsPerSecond) % 1; // 0 to 1 phase
  
  return {
    baseSpeed,
    pulseIntensity,
    rhythmPhase
  };
}

/**
 * Creates smooth transitions based on analysis data
 */
export function getTransitionEffects(analysis: AudioAnalysisMessage | null): {
  smoothness: number;
  changeVelocity: number;
  energyDirection: 'up' | 'down' | 'stable';
  anticipation: number;
} {
  if (!analysis) {
    return {
      smoothness: 0.8,
      changeVelocity: 0,
      energyDirection: 'stable',
      anticipation: 0
    };
  }
  
  const { transitions, predictions } = analysis.relationships;
  
  // Determine anticipation level based on predictions
  const anticipation = Math.max(
    predictions.drop_probability,
    predictions.buildup_probability,
    predictions.break_probability
  );
  
  return {
    smoothness: transitions.transition_smoothness,
    changeVelocity: transitions.change_velocity,
    energyDirection: transitions.energy_direction as 'up' | 'down' | 'stable',
    anticipation
  };
}

/**
 * Applies predictive visual effects based on analysis
 */
export function getPredictiveEffects(analysis: AudioAnalysisMessage | null): {
  buildupIntensity: number;
  dropAnticipation: number;
  breakMinimalism: number;
  tension: number;
} {
  if (!analysis) {
    return {
      buildupIntensity: 0,
      dropAnticipation: 0,
      breakMinimalism: 0,
      tension: 0
    };
  }
  
  const { predictions } = analysis.relationships;
  
  // Calculate visual tension based on multiple factors
  const tension = Math.min(
    predictions.buildup_probability * 0.4 +
    predictions.drop_probability * 0.6 +
    (analysis.relationships.trends.volatility * 0.3),
    1
  );
  
  return {
    buildupIntensity: predictions.buildup_probability,
    dropAnticipation: predictions.drop_probability,
    breakMinimalism: predictions.break_probability,
    tension
  };
}

/**
 * Creates camera movement based on audio analysis
 */
export function getCameraMovement(
  analysis: AudioAnalysisMessage | null,
  chunk: AudioChunkData,
  time: number
): {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  fov: number;
} {
  const baseRadius = 15;
  const baseHeight = 2;
  
  // Slow orbital movement modified by music
  const orbitSpeed = 0.0003 + (chunk.tempo / 120) * 0.0002;
  const angle = time * orbitSpeed;
  
  // Height variation based on energy and analysis
  const energyHeight = (chunk.amplitude - 0.5) * 4;
  const analysisHeight = analysis ? 
    (analysis.relationships.trends.overall_energy_trend * 2) : 0;
  
  // Radius variation based on intensity
  const intensityRadius = chunk.beat_strength * 3;
  
  const position = new THREE.Vector3(
    Math.cos(angle) * (baseRadius + intensityRadius),
    baseHeight + energyHeight + analysisHeight,
    Math.sin(angle) * (baseRadius + intensityRadius)
  );
  
  // Look at energy center with some smoothing
  const energyCenterY = (chunk.energy_center / 20000) * 6 - 3;
  const lookAt = new THREE.Vector3(0, energyCenterY, 0);
  
  // Field of view changes with intensity and predictions
  const baseFOV = 75;
  const intensityFOV = chunk.amplitude * 10;
  const anticipationFOV = analysis ? 
    (analysis.relationships.predictions.drop_probability * 15) : 0;
  
  return {
    position,
    lookAt,
    fov: baseFOV + intensityFOV + anticipationFOV
  };
}

/**
 * Smooth lerping with different easing curves
 */
export function smoothLerp(
  current: number,
  target: number,
  factor: number,
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' = 'linear'
): number {
  let adjustedFactor = factor;
  
  switch (easing) {
    case 'ease-in':
      adjustedFactor = factor * factor;
      break;
    case 'ease-out':
      adjustedFactor = 1 - (1 - factor) * (1 - factor);
      break;
    case 'ease-in-out':
      adjustedFactor = factor < 0.5 
        ? 2 * factor * factor 
        : 1 - 2 * (1 - factor) * (1 - factor);
      break;
  }
  
  return current + (target - current) * adjustedFactor;
}