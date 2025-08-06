import * as THREE from "three"
import { type AudioChunkData } from "../types"

export interface Particle {
  id: number
  position: THREE.Vector3
  velocity: THREE.Vector3
  frequencyBand: number
  baseSize: number
  currentSize: number
  targetSize: number
  color: THREE.Color
  mesh?: THREE.Mesh
}


export function initializeParticles(initialChunk: AudioChunkData): Particle[] {
  const particleCount = 200
  const newParticles: Particle[] = []
  const numFrequencyBands = initialChunk.frequencies.length
  const {
    frequencies,
    amplitude,
    brightness,
    energy_center,
    spectral_flatness,
    chroma_features,
    beat_strength,
    tempo,
  } = initialChunk

  for (let i = 0; i < particleCount; i++) {
    const frequencyIndex = Math.floor(Math.random() * numFrequencyBands)
    const frequencyValue = frequencies?.[frequencyIndex] || 0
    const normalizedIndex = frequencyIndex / numFrequencyBands

    // Posición inicial influenciada por la energía central y la amplitud
    const positionRadius = 5 + amplitude * 5
    const angle = Math.random() * Math.PI * 2
    const heightOffset = (energy_center / 20000) * 10 - 5 // Normalize energy center to a range
    const initialPosition = new THREE.Vector3(
      Math.cos(angle) * positionRadius + (Math.random() - 0.5) * 2,
      heightOffset + (Math.random() - 0.5) * 2,
      Math.sin(angle) * positionRadius + (Math.random() - 0.5) * 2
    )

    // Velocidad inicial influenciada por el tempo y el beat strength
    const tempoFactor = tempo / 120
    const beatInfluence = beat_strength * 0.1
    const initialVelocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.02 * tempoFactor + (Math.random() - 0.5) * beatInfluence,
      (Math.random() - 0.5) * 0.02 * tempoFactor + (Math.random() - 0.5) * beatInfluence,
      (Math.random() - 0.5) * 0.02 * tempoFactor + (Math.random() - 0.5) * beatInfluence
    )

    // Tamaño base influenciado por la amplitud y la planitud espectral
    const baseSize = 0.05 + amplitude * 0.1 + (1 - spectral_flatness) * 0.05

    // Color inicial basado en la banda de frecuencia, brillo y características de croma
    let hue = normalizedIndex * 0.8 + brightness * 0.2
    const saturation = 0.6 + amplitude * 0.4
    const lightness = 0.4 + frequencyValue * 0.4 + brightness * 0.2

    // Influencia del croma (si hay una nota dominante)
    const dominantChromaIndex = chroma_features.indexOf(Math.max(...chroma_features))
    if (dominantChromaIndex !== -1) {
      hue = (dominantChromaIndex / 12) % 1 // Normalize to 0-1 range
    }

    const initialColor = new THREE.Color().setHSL(hue, saturation, lightness)

    const particle: Particle = {
      id: i,
      position: initialPosition,
      velocity: initialVelocity,
      frequencyBand: frequencyIndex,
      baseSize,
      currentSize: baseSize,
      targetSize: baseSize,
      color: initialColor,
      // La propiedad 'mesh' se asigna dentro del componente de React
      // cuando el <mesh> se monta en el DOM virtual de Three.js.
    }
    newParticles.push(particle)
  }

  return newParticles
}