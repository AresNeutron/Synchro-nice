import * as THREE from "three";
import type { AudioChunkData, AudioAnalysisMessage } from "../types";

/**
 * Creates a 3D position based on audio characteristics
 */
export function createSpatialPosition(
  chunk: AudioChunkData,
  frequencyBand: number,
  particleIndex: number,
  totalParticles: number
): THREE.Vector3 {
  const totalBands = chunk.frequencies.length;
  
  // Vertical position based on frequency band (low=bottom, high=top)
  const baseHeight = getFrequencyHeight(frequencyBand, totalBands);
  
  // Radial position based on energy center and amplitude
  const energyCenterNormalized = Math.min(chunk.energy_center / 20000, 1); // Normalize to 0-1
  const radius = 3 + chunk.amplitude * 7 + energyCenterNormalized * 3; // 3-13 range
  
  // Angular position - distribute particles around circle with some musical logic
  const baseAngle = (particleIndex / totalParticles) * Math.PI * 2;
  
  // Modify angle based on chroma features (musical harmony affects positioning)
  const dominantChroma = chunk.chroma_features.indexOf(Math.max(...chunk.chroma_features));
  const harmonicShift = dominantChroma !== -1 ? (dominantChroma / 12) * Math.PI * 0.5 : 0;
  const angle = baseAngle + harmonicShift;
  
  // Add some controlled randomness based on spectral flatness
  const chaos = chunk.spectral_flatness * 2 - 1; // -1 to 1
  const randomOffset = chaos * 1.5;
  
  return new THREE.Vector3(
    Math.cos(angle) * radius + (Math.random() - 0.5) * randomOffset,
    baseHeight + (Math.random() - 0.5) * 1,
    Math.sin(angle) * radius + (Math.random() - 0.5) * randomOffset
  );
}

/**
 * Maps frequency band to height in 3D space
 */
export function getFrequencyHeight(frequencyBand: number, totalBands: number = 20): number {
  const normalizedBand = frequencyBand / (totalBands - 1);
  // Exponential curve for more natural frequency distribution
  const exponentialBand = Math.pow(normalizedBand, 1.5);
  return -6 + exponentialBand * 14; // -6 to 8 range
}

/**
 * Creates velocity based on tempo, beat strength, and energy direction
 */
export function createSpatialVelocity(
  chunk: AudioChunkData,
  analysis?: AudioAnalysisMessage
): THREE.Vector3 {
  const tempoFactor = chunk.tempo / 120; // Normalize around 120 BPM
  const baseSpeed = 0.01 * tempoFactor;
  
  // Beat-driven impulses
  const beatImpulse = chunk.is_percussive ? chunk.beat_strength * 0.08 : 0;
  
  // Energy direction from analysis (if available)
  let energyDirection = new THREE.Vector3(0, 0, 0);
  if (analysis) {
    switch (analysis.relationships.trends.overall_energy_trend) {
      case 1: // increasing
        energyDirection.y = 0.02;
        break;
      case -1: // decreasing  
        energyDirection.y = -0.02;
        break;
      default: // stable
        energyDirection.y = 0;
    }
  }
  
  // Random movement modulated by spectral flatness (noise = more random)
  const randomness = chunk.spectral_flatness * 0.03;
  
  return new THREE.Vector3(
    (Math.random() - 0.5) * (baseSpeed + randomness) + energyDirection.x,
    (Math.random() - 0.5) * (baseSpeed + randomness) + energyDirection.y + beatImpulse,
    (Math.random() - 0.5) * (baseSpeed + randomness) + energyDirection.z
  );
}

/**
 * Calculates particle size based on frequency amplitude and overall volume
 */
export function calculateParticleSize(
  baseSize: number,
  frequencyAmplitude: number,
  overallAmplitude: number,
  spectralFlatness: number
): number {
  // Base size modulated by frequency-specific amplitude
  const frequencyMultiplier = 1 + frequencyAmplitude * 4;
  
  // Overall amplitude provides global scaling
  const amplitudeMultiplier = 0.5 + overallAmplitude * 1.5;
  
  // Spectral flatness affects size variation (tonal = consistent, noisy = varied)
  const consistencyFactor = 0.7 + (1 - spectralFlatness) * 0.6;
  
  return baseSize * frequencyMultiplier * amplitudeMultiplier * consistencyFactor;
}

/**
 * Creates gravitational pull point based on energy center
 */
export function getEnergyCenter(chunk: AudioChunkData): THREE.Vector3 {
  const energyCenterNormalized = Math.min(chunk.energy_center / 20000, 1);
  
  // Height based on energy center frequency
  const height = -4 + energyCenterNormalized * 10;
  
  // Position shifts based on dominant chroma
  const dominantChroma = chunk.chroma_features.indexOf(Math.max(...chunk.chroma_features));
  const angle = dominantChroma !== -1 ? (dominantChroma / 12) * Math.PI * 2 : 0;
  
  const radius = 2 + chunk.amplitude * 3;
  
  return new THREE.Vector3(
    Math.cos(angle) * radius,
    height,
    Math.sin(angle) * radius
  );
}

/**
 * Applies boundary constraints to keep particles in view
 */
export function applyBoundaryConstraints(
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  bounds: { x: number; y: number; z: number } = { x: 12, y: 10, z: 12 }
): { position: THREE.Vector3; velocity: THREE.Vector3 } {
  const newPosition = position.clone();
  const newVelocity = velocity.clone();
  
  // Bounce off boundaries with damping
  if (Math.abs(newPosition.x) > bounds.x) {
    newVelocity.x *= -0.7;
    newPosition.x = Math.sign(newPosition.x) * bounds.x;
  }
  
  if (newPosition.y > bounds.y) {
    newVelocity.y *= -0.7;
    newPosition.y = bounds.y;
  } else if (newPosition.y < -bounds.y) {
    newVelocity.y *= -0.7;
    newPosition.y = -bounds.y;
  }
  
  if (Math.abs(newPosition.z) > bounds.z) {
    newVelocity.z *= -0.7;
    newPosition.z = Math.sign(newPosition.z) * bounds.z;
  }
  
  return { position: newPosition, velocity: newVelocity };
}