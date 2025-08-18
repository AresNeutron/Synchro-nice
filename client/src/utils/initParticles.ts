import * as THREE from "three";
import type { AudioChunkData } from "../types";
import { createSynestheticColor, getChromaColor } from "./colorMapping";
import { createSpatialPosition, createSpatialVelocity } from "./spatialMapping";

export interface Particle {
  // Core identification
  id: number;
  layer: 'foundation' | 'harmony' | 'atmosphere'; // Visual layer system
  frequencyBand: number; // 0-19 for 20 frequency bands
  
  // Spatial properties
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetPosition: THREE.Vector3;
  
  // Size and scaling
  baseSize: number;
  currentSize: number;
  targetSize: number;
  sizeVelocity: number; // For smooth size transitions
  
  // Visual properties
  color: THREE.Color;
  targetColor: THREE.Color;
  opacity: number;
  targetOpacity: number;
  
  // Animation state
  lastUpdateTime: number;
  pulsePhase: number; // 0-1 for beat-synchronized pulsing
  harmonicResonance: number; // Strength of musical harmony response
  
  // Three.js reference
  mesh?: THREE.Mesh;
}

/**
 * Creates the complete particle system with layered synesthetic mapping
 */
export function initializeParticles(initialChunk: AudioChunkData): Particle[] {
  const particles: Particle[] = [];
  const totalParticles = 300; // Increased for richer visualization
  
  // Layer distribution: 40% foundation, 40% harmony, 20% atmosphere
  const layerCounts = {
    foundation: Math.floor(totalParticles * 0.4),   // Low frequencies
    harmony: Math.floor(totalParticles * 0.4),       // Mid frequencies  
    atmosphere: Math.floor(totalParticles * 0.2)     // High frequencies
  };
  
  let particleId = 0;
  
  // Create Foundation Layer (Bass/Low frequencies - particles 0-7)
  for (let i = 0; i < layerCounts.foundation; i++) {
    const frequencyBand = Math.floor(Math.random() * 8); // Bands 0-7 (low)
    particles.push(createLayerParticle(
      particleId++,
      'foundation',
      frequencyBand,
      i,
      layerCounts.foundation,
      initialChunk
    ));
  }
  
  // Create Harmony Layer (Mid frequencies - particles 6-14)  
  for (let i = 0; i < layerCounts.harmony; i++) {
    const frequencyBand = 6 + Math.floor(Math.random() * 9); // Bands 6-14 (mid)
    particles.push(createLayerParticle(
      particleId++,
      'harmony', 
      frequencyBand,
      i,
      layerCounts.harmony,
      initialChunk
    ));
  }
  
  // Create Atmosphere Layer (High frequencies - particles 12-19)
  for (let i = 0; i < layerCounts.atmosphere; i++) {
    const frequencyBand = 12 + Math.floor(Math.random() * 8); // Bands 12-19 (high)
    particles.push(createLayerParticle(
      particleId++,
      'atmosphere',
      frequencyBand, 
      i,
      layerCounts.atmosphere,
      initialChunk
    ));
  }
  
  return particles;
}

/**
 * Creates a particle for a specific visual layer with appropriate characteristics
 */
function createLayerParticle(
  id: number,
  layer: 'foundation' | 'harmony' | 'atmosphere',
  frequencyBand: number,
  _layerIndex: number,
  _layerTotal: number,
  chunk: AudioChunkData
): Particle {
  // Get frequency-specific amplitude
  const frequencyAmplitude = chunk.frequencies[frequencyBand] || 0;
  
  // Layer-specific characteristics
  const layerConfig = getLayerConfig(layer);
  
  // Create spatial position based on layer and audio data
  const position = createSpatialPosition(chunk, frequencyBand, id, 300);
  
  // Adjust position based on layer preferences
  position.y += layerConfig.heightOffset;
  position.multiplyScalar(layerConfig.spaceScale);
  
  // Create velocity with layer-specific behavior
  const velocity = createSpatialVelocity(chunk);
  velocity.multiplyScalar(layerConfig.mobilityScale);
  
  // Size based on frequency amplitude and layer
  const baseSize = layerConfig.baseSize * (0.7 + frequencyAmplitude * 0.6);
  
  // Color based on synesthetic mapping
  const color = createSynestheticColor(chunk);
  
  // Layer-specific color adjustments
    adjustColorForLayer(color, layer);
  
  // Calculate harmonic resonance based on chroma features
  const chromaColor = getChromaColor(chunk.chroma_features);
  const harmonicResonance = chromaColor.strength * layerConfig.harmonicSensitivity;
  
  return {
    id,
    layer,
    frequencyBand,
    
    position: position.clone(),
    velocity,
    targetPosition: position.clone(),
    
    baseSize,
    currentSize: baseSize,
    targetSize: baseSize,
    sizeVelocity: 0,
    
    color: color.clone(),
    targetColor: color.clone(),
    opacity: layerConfig.baseOpacity,
    targetOpacity: layerConfig.baseOpacity,
    
    lastUpdateTime: 0,
    pulsePhase: Math.random(), // Random starting phase
    harmonicResonance,
  };
}

/**
 * Layer-specific configuration for different frequency ranges
 */
function getLayerConfig(layer: 'foundation' | 'harmony' | 'atmosphere') {
  switch (layer) {
    case 'foundation':
      return {
        heightOffset: -2,      // Closer to ground
        spaceScale: 0.8,       // Smaller spatial range
        mobilityScale: 0.6,    // Slower movement
        baseSize: 0.15,        // Larger particles
        baseOpacity: 0.9,      // More solid
        harmonicSensitivity: 0.7, // Less harmonic influence
      };
      
    case 'harmony':
      return {
        heightOffset: 1,       // Mid-level
        spaceScale: 1.0,       // Normal spatial range  
        mobilityScale: 1.0,    // Normal movement
        baseSize: 0.08,        // Medium particles
        baseOpacity: 0.8,      // Semi-transparent
        harmonicSensitivity: 1.0, // Full harmonic response
      };
      
    case 'atmosphere':
      return {
        heightOffset: 4,       // Higher up
        spaceScale: 1.4,       // Larger spatial range
        mobilityScale: 1.8,    // Faster, more erratic
        baseSize: 0.04,        // Smaller particles  
        baseOpacity: 0.6,      // More transparent
        harmonicSensitivity: 0.5, // Some harmonic influence
      };
  }
}

/**
 * Adjusts color characteristics based on layer
 */
function adjustColorForLayer(
  color: THREE.Color,
  layer: 'foundation' | 'harmony' | 'atmosphere',
) {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  
  switch (layer) {
    case 'foundation':
      // Warmer, earthier colors
      hsl.h = (hsl.h + 0.1) % 1; // Shift toward orange/red
      hsl.s = Math.max(hsl.s - 0.1, 0.3); // Less saturated
      hsl.l = Math.max(hsl.l - 0.1, 0.2); // Darker
      break;
      
    case 'harmony':
      // Balanced, musical colors - keep as is
      break;
      
    case 'atmosphere':
      // Cooler, lighter colors
      hsl.h = (hsl.h + 0.5) % 1; // Shift toward cyan/blue
      hsl.s = Math.min(hsl.s + 0.2, 1); // More saturated
      hsl.l = Math.min(hsl.l + 0.2, 0.9); // Lighter
      break;
  }
  
  color.setHSL(hsl.h, hsl.s, hsl.l);
}

/**
 * Updates particle properties based on new audio data
 */
export function updateParticle(
  particle: Particle,
  chunk: AudioChunkData,
  deltaTime: number
): void {
  const frequencyAmplitude = chunk.frequencies[particle.frequencyBand] || 0;
  const timing = (chunk.tempo / 120) * deltaTime;
  
  // Update size based on frequency amplitude
  const energyMultiplier = 1 + frequencyAmplitude * chunk.amplitude * 3;
  particle.targetSize = particle.baseSize * energyMultiplier;
  
  // Beat-driven pulsing
  if (chunk.is_percussive && chunk.beat_strength > 0.3) {
    particle.targetSize *= 1 + chunk.beat_strength * 0.5;
  }
  
  // Smooth size transitions
  const sizeLerpFactor = Math.min(deltaTime * 8, 1);
  particle.currentSize = THREE.MathUtils.lerp(
    particle.currentSize, 
    particle.targetSize, 
    sizeLerpFactor
  );
  
  // Update color based on current audio state
  particle.targetColor = createSynestheticColor(chunk);
  adjustColorForLayer(particle.targetColor, particle.layer);
  
  // Smooth color transitions
  const colorLerpFactor = Math.min(deltaTime * 4, 1);
  particle.color.lerp(particle.targetColor, colorLerpFactor);
  
  // Update pulse phase for rhythmic animations
  particle.pulsePhase = (particle.pulsePhase + timing * 2) % 1;
  
  // Update harmonic resonance
  const chromaColor = getChromaColor(chunk.chroma_features);
  particle.harmonicResonance = THREE.MathUtils.lerp(
    particle.harmonicResonance,
    chromaColor.strength,
    deltaTime * 2
  );
}