"use client"

import type React from "react"
import { useRef, useEffect, useMemo, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useAppContext } from "../hooks/useAppContext"
import { APPSTATE, initialVisualizerState, type AudioChunkData } from "../types"
import * as THREE from "three"

interface Particle {
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

// Particle Equalizer System Component
function ParticleEqualizer() {
  const { chunks} = useAppContext()
  const groupRef = useRef<THREE.Group>(null)
  const particlesRef = useRef<Particle[]>([])
  const [visualizerState, setVisualizerState] = useState<AudioChunkData>(initialVisualizerState)

  // Initialize particles
  const particles = useMemo(() => {
    const particleCount = 200
    const newParticles: Particle[] = []

    for (let i = 0; i < particleCount; i++) {
      const particle: Particle = {
        id: i,
        position: new THREE.Vector3((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
        ),
        frequencyBand: Math.floor(Math.random() * 20), // Assign to one of 20 frequency bands
        baseSize: 0.05 + Math.random() * 0.1,
        currentSize: 0.05,
        targetSize: 0.05,
        color: new THREE.Color(0.5, 0.3, 0.8),
      }
      newParticles.push(particle)
    }

    particlesRef.current = newParticles
    return newParticles
  }, [])

  // Update visualizer state from chunks
  useEffect(() => {
    if (chunks.length > 0) {
      const latestChunk = chunks[0]
      setVisualizerState((prevState) => {
        // Smooth interpolation to new state
        return {
          timestamp: latestChunk.timestamp,
          frequencies: latestChunk.frequencies.map((freq, i) =>
            THREE.MathUtils.lerp(prevState.frequencies[i] || 0, freq, 0.3),
          ),
          amplitude: THREE.MathUtils.lerp(prevState.amplitude, latestChunk.amplitude, 0.2),
          brightness: THREE.MathUtils.lerp(prevState.brightness, latestChunk.brightness, 0.1),
          energy_center: THREE.MathUtils.lerp(prevState.energy_center, latestChunk.energy_center, 0.1),
          is_percussive: latestChunk.is_percussive,
          rolloff: THREE.MathUtils.lerp(prevState.rolloff, latestChunk.rolloff, 0.1),
          zero_crossing_rate: THREE.MathUtils.lerp(prevState.zero_crossing_rate, latestChunk.zero_crossing_rate, 0.1),
          spectral_flatness: THREE.MathUtils.lerp(prevState.spectral_flatness, latestChunk.spectral_flatness, 0.1),
          chroma_features: latestChunk.chroma_features.map((chroma, i) =>
            THREE.MathUtils.lerp(prevState.chroma_features[i] || 0, chroma, 0.2),
          ),
          beat_strength: THREE.MathUtils.lerp(prevState.beat_strength, latestChunk.beat_strength, 0.3),
          tempo: THREE.MathUtils.lerp(prevState.tempo, latestChunk.tempo, 0.05),
        }
      })
    }
  }, [chunks])

  useFrame((state) => {
    if (!groupRef.current) return

    const time = state.clock.elapsedTime
    const deltaTime = state.clock.getDelta()

    particlesRef.current.forEach((particle) => {
      if (!particle.mesh) return

      // Get frequency data for this particle's band
      const frequencyValue = visualizerState.frequencies[particle.frequencyBand] || 0

      // Calculate target size based on frequency intensity (like equalizer bars)
      const frequencyMultiplier = 1 + frequencyValue * visualizerState.amplitude * 8
      particle.targetSize = particle.baseSize * frequencyMultiplier

      // Smooth size interpolation (equalizer-like response)
      particle.currentSize = THREE.MathUtils.lerp(particle.currentSize, particle.targetSize, 0.15)
      particle.mesh.scale.setScalar(particle.currentSize)

      // Color based on frequency band and audio characteristics
      const hue = (particle.frequencyBand / 20) * 0.8 + visualizerState.brightness * 0.3
      const saturation = 0.7 + visualizerState.spectral_flatness * 0.3
      const lightness = 0.3 + frequencyValue * 0.6 + visualizerState.amplitude * 0.3

      // Add chroma influence
      const dominantChroma = visualizerState.chroma_features.indexOf(Math.max(...visualizerState.chroma_features))
      if (dominantChroma !== -1) {
        const chromaInfluence = visualizerState.chroma_features[dominantChroma] * 0.3
        particle.color.setHSL((hue + dominantChroma * 0.08) % 1, saturation, lightness + chromaInfluence)
      } else {
        particle.color.setHSL(hue, saturation, lightness)
      }

      const material = particle.mesh.material as THREE.MeshBasicMaterial
      material.color.copy(particle.color)

      // Movement like equalizer bars - more responsive to audio
      const tempoMultiplier = (visualizerState.tempo / 120) * 0.5 + 0.5

      // Random direction changes based on beat strength and percussion
      if (visualizerState.is_percussive && Math.random() < visualizerState.beat_strength * 0.3) {
        particle.velocity.x += (Math.random() - 0.5) * 0.05 * visualizerState.beat_strength
        particle.velocity.y += (Math.random() - 0.5) * 0.05 * visualizerState.beat_strength
        particle.velocity.z += (Math.random() - 0.5) * 0.05 * visualizerState.beat_strength
      }

      // Frequency-based movement direction
      const frequencyForce = frequencyValue * 0.02
      particle.velocity.y += frequencyForce * (particle.frequencyBand < 10 ? 1 : -1) // Low freq up, high freq down

      // Apply velocity with tempo influence
      particle.position.add(particle.velocity.clone().multiplyScalar(tempoMultiplier * (1 + visualizerState.amplitude)))

      // Update mesh position
      particle.mesh.position.copy(particle.position)

      // Boundary wrapping (like particles bouncing around)
      const boundarySize = 8
      if (Math.abs(particle.position.x) > boundarySize) {
        particle.velocity.x *= -0.8
        particle.position.x = Math.sign(particle.position.x) * boundarySize
      }
      if (Math.abs(particle.position.y) > boundarySize) {
        particle.velocity.y *= -0.8
        particle.position.y = Math.sign(particle.position.y) * boundarySize
      }
      if (Math.abs(particle.position.z) > boundarySize) {
        particle.velocity.z *= -0.8
        particle.position.z = Math.sign(particle.position.z) * boundarySize
      }

      // Damping
      particle.velocity.multiplyScalar(0.98)

      // Add some random movement to keep particles alive
      particle.velocity.add(
        new THREE.Vector3((Math.random() - 0.5) * 0.001, (Math.random() - 0.5) * 0.001, (Math.random() - 0.5) * 0.001),
      )
    })

    // Rotate entire group slowly
    groupRef.current.rotation.y += 0.002 * (visualizerState.tempo / 120)
  })

  return (
    <group ref={groupRef}>
      {particles.map((particle) => (
        <mesh
          key={particle.id}
          ref={(mesh) => {
            if (mesh) {
              particle.mesh = mesh
              mesh.position.copy(particle.position)
            }
          }}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  )
}

// Simple Camera Controller
function CameraController() {
  const { camera } = useThree()

  useFrame(() => {
    // Simple orbital camera movement
    const time = Date.now() * 0.0005
    camera.position.x = Math.cos(time) * 12
    camera.position.z = Math.sin(time) * 12
    camera.position.y = Math.sin(time * 0.5) * 3
    camera.lookAt(0, 0, 0)
  })

  return null
}

// Main Scene Component
function VisualizerScene() {
  return (
    <>
      <CameraController />
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.6} />

      <ParticleEqualizer />

      {/* Dark background */}
      <mesh position={[0, 0, -15]} scale={[30, 30, 1]}>
        <planeGeometry />
        <meshBasicMaterial color="#0a0a0a" />
      </mesh>
    </>
  )
}

// Main Visualizer Component
const Visualizer: React.FC = () => {
  const { isConnected, appState } = useAppContext()

  if (!isConnected || appState !== APPSTATE.PLAYING) {
    return (
      <div className="w-full h-96 bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-400/20 flex items-center justify-center">
            <div className="w-8 h-8 bg-purple-400 rounded-full animate-pulse"></div>
          </div>
          <p className="text-gray-400">
            {!isConnected ? "Waiting for connection..." : "Press play to start visualization"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-96 rounded-lg overflow-hidden bg-black">
      <Canvas camera={{ position: [12, 0, 0], fov: 75 }} gl={{ antialias: true }}>
        <VisualizerScene />
      </Canvas>
    </div>
  )
}

export default Visualizer
