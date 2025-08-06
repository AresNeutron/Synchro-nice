import type React from "react"
import { useRef, useEffect, useMemo, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useAppContext } from "../hooks/useAppContext"
import { APPSTATE, initialVisualizerState, type AudioChunkData } from "../types"
import * as THREE from "three"
import { initializeParticles, type Particle } from "../utils/initParticles"


function ParticleEqualizer() {
  const { chunks } = useAppContext()
  const groupRef = useRef<THREE.Group>(null)
  const particlesRef = useRef<Particle[]>([])
  const [visualizerState, setVisualizerState] = useState<AudioChunkData>(initialVisualizerState)

  useEffect(() => {
    if (chunks.length > 0) {
      const latestChunk = chunks[0]
      console.log('✅ New audio chunk received:', latestChunk.timestamp);
      setVisualizerState((prevState) => {
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

  const particles = useMemo(() => {
    if (chunks.length > 0) {
      console.log('✨ Initializing particles with first chunk data');
      const newParticles = initializeParticles(chunks[0]);
      particlesRef.current = newParticles;
      return newParticles;
    }
    console.log('⏳ Waiting for first audio chunk to initialize particles');
    return [];
  }, [chunks]);

  useFrame(() => {
    if (!groupRef.current || particlesRef.current.length === 0) {
      console.log('🚫 Skipping frame: Group or particles not ready.');
      return;
    }

    particlesRef.current.forEach((particle) => {
      if (!particle.mesh) {
        console.warn('⚠️ Particle without mesh found, skipping animation.');
        return;
      }

      const frequencyValue = visualizerState.frequencies[particle.frequencyBand] || 0

      const frequencyMultiplier = 1 + frequencyValue * visualizerState.amplitude * 8
      particle.targetSize = particle.baseSize * frequencyMultiplier

      particle.currentSize = THREE.MathUtils.lerp(particle.currentSize, particle.targetSize, 0.15)
      particle.mesh.scale.setScalar(particle.currentSize)

      const hue = (particle.frequencyBand / 20) * 0.8 + visualizerState.brightness * 0.3
      const saturation = 0.7 + visualizerState.spectral_flatness * 0.3
      const lightness = 0.3 + frequencyValue * 0.6 + visualizerState.amplitude * 0.3

      const dominantChroma = visualizerState.chroma_features.indexOf(Math.max(...visualizerState.chroma_features))
      if (dominantChroma !== -1) {
        const chromaInfluence = visualizerState.chroma_features[dominantChroma] * 0.3
        particle.color.setHSL((hue + dominantChroma * 0.08) % 1, saturation, lightness + chromaInfluence)
      } else {
        particle.color.setHSL(hue, saturation, lightness)
      }

      const material = particle.mesh.material as THREE.MeshBasicMaterial
      material.color.copy(particle.color)

      const tempoMultiplier = (visualizerState.tempo / 120) * 0.5 + 0.5

      if (visualizerState.is_percussive && Math.random() < visualizerState.beat_strength * 0.3) {
        particle.velocity.x += (Math.random() - 0.5) * 0.05 * visualizerState.beat_strength
        particle.velocity.y += (Math.random() - 0.5) * 0.05 * visualizerState.beat_strength
        particle.velocity.z += (Math.random() - 0.5) * 0.05 * visualizerState.beat_strength
      }

      const frequencyForce = frequencyValue * 0.02
      particle.velocity.y += frequencyForce * (particle.frequencyBand < 10 ? 1 : -1)

      particle.position.add(particle.velocity.clone().multiplyScalar(tempoMultiplier * (1 + visualizerState.amplitude)))

      particle.mesh.position.copy(particle.position)

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

      particle.velocity.multiplyScalar(0.98)

      particle.velocity.add(
        new THREE.Vector3((Math.random() - 0.5) * 0.001, (Math.random() - 0.5) * 0.001, (Math.random() - 0.5) * 0.001),
      )
    })

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

function CameraController() {
  const { camera } = useThree()

  useFrame(() => {
    const time = Date.now() * 0.0005
    camera.position.x = Math.cos(time) * 12
    camera.position.z = Math.sin(time) * 12
    camera.position.y = Math.sin(time * 0.5) * 3
    camera.lookAt(0, 0, 0)
  })

  return null
}

function VisualizerScene() {
  return (
    <>
      <CameraController />
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.6} />

      <ParticleEqualizer />

      <mesh position={[0, 0, -15]} scale={[30, 30, 1]}>
        <planeGeometry />
        <meshBasicMaterial color="#0a0a0a" />
      </mesh>
    </>
  )
}

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
    <div className="w-full h-full rounded-lg overflow-hidden bg-black">
      <Canvas camera={{ position: [12, 0, 0], fov: 75 }} gl={{ antialias: true }}>
        <VisualizerScene />
      </Canvas>
    </div>
  )
}

export default Visualizer