import type React from "react";
import { useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useAppContext } from "../hooks/useAppContext";
import { APPSTATE, type AudioChunkData, type AudioAnalysisMessage } from "../types";
import * as THREE from "three";
import { initializeParticles, updateParticle, type Particle } from "../utils/initParticles";
import { interpolateAudioData, getCameraMovement, getAnimationTiming } from "../utils/animationHelpers";
import { applyBoundaryConstraints } from "../utils/spatialMapping";

/**
 * Synchronized audio visualizer with proper timeline integration
 */
function SynestheticVisualizer() {
  const { appState,audioChunks,  getChunkByTimestamp, getAnalysisByTimestamp } = useAppContext();
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // Get reference to the audio element for synchronization
  useEffect(() => {
    const audioElement = document.querySelector('audio') as HTMLAudioElement;
    if (audioElement) {
      audioElementRef.current = audioElement;
    }
  }, []);

  // Initialize particles when we have audio data
  useEffect(() => {
    console.log('🔍 Initialization check:', {
      audioChunksLength: audioChunks.length,
      isInitialized,
      appState,
      isPlaying: appState === APPSTATE.PLAYING
    });
    
    if (audioChunks.length > 0 && !isInitialized) {
      console.log('🎨 Initializing synesthetic visualizer with', audioChunks.length, 'chunks');
      const initialChunk = audioChunks[0];
      particlesRef.current = initializeParticles(initialChunk);
      setIsInitialized(true);
    }
  }, [audioChunks, isInitialized, appState]);

  // Main animation loop with perfect synchronization
  useFrame((state) => {
    if (!groupRef.current || !audioElementRef.current || particlesRef.current.length === 0 || appState !== APPSTATE.PLAYING) {
      return;
    }

    const currentTime = audioElementRef.current.currentTime;
    const deltaTime = state.clock.getElapsedTime() - lastUpdateTimeRef.current;
    lastUpdateTimeRef.current = state.clock.getElapsedTime();

    // Get synchronized audio data
    const currentChunk = getChunkByTimestamp(currentTime);
    const nextChunk = getChunkByTimestamp(currentTime + 0.2); // Next chunk for interpolation
    const currentAnalysis = getAnalysisByTimestamp(currentTime);

    if (!currentChunk) {
      return; // No data available for current time
    }

    // Interpolate between chunks for smooth 60fps animation
    const chunkProgress = (currentTime % 0.2) / 0.2; // 0-1 within current chunk
    const interpolatedChunk = interpolateAudioData(currentChunk, nextChunk, chunkProgress);

    // Update all particles with current audio data
    updateParticles(interpolatedChunk, currentAnalysis, deltaTime);

    // Update global scene effects
    updateSceneEffects(groupRef.current, interpolatedChunk, currentAnalysis, state.clock.elapsedTime);
  });

  /**
   * Updates all particles based on current audio data
   */
  const updateParticles = (
    chunk: AudioChunkData, 
    analysis: AudioAnalysisMessage | null,
    deltaTime: number
  ) => {
    const timing = getAnimationTiming(chunk);
    
    particlesRef.current.forEach((particle) => {
      if (!particle.mesh) return;

      // Update particle properties based on audio data
      updateParticle(particle, chunk, deltaTime);

      // Apply size scaling with beat pulsing
      const pulseScale = 1 + Math.sin(particle.pulsePhase * Math.PI * 2) * 0.2 * timing.pulseIntensity;
      particle.mesh.scale.setScalar(particle.currentSize * pulseScale);

      // Update particle color
      const material = particle.mesh.material as THREE.MeshBasicMaterial;
      material.color.copy(particle.color);
      material.opacity = particle.opacity;

      // Update particle position with physics
      updateParticlePhysics(particle, chunk, analysis, deltaTime, timing);

      // Apply position to mesh
      particle.mesh.position.copy(particle.position);
    });
  };

  /**
   * Updates particle physics and movement
   */
  const updateParticlePhysics = (
    particle: Particle,
    chunk: AudioChunkData,
    analysis: AudioAnalysisMessage | null,
    deltaTime: number,
    timing: { baseSpeed: number; pulseIntensity: number; rhythmPhase: number }
  ) => {
    const frequencyAmplitude = chunk.frequencies[particle.frequencyBand] || 0;

    // Energy-based movement
    const energyForce = frequencyAmplitude * chunk.amplitude * 0.05;
    const energyDirection = new THREE.Vector3(0, 1, 0); // Upward for high energy
    
    // Beat-driven impulses
    if (chunk.is_percussive && timing.pulseIntensity > 0.5) {
      const beatImpulse = new THREE.Vector3(
        (Math.random() - 0.5) * timing.pulseIntensity * 0.1,
        Math.random() * timing.pulseIntensity * 0.15,
        (Math.random() - 0.5) * timing.pulseIntensity * 0.1
      );
      particle.velocity.add(beatImpulse);
    }

    // Analysis-based forces
    if (analysis) {
      const { trends, transitions } = analysis.relationships;
      
      // Energy direction influence
      switch (transitions.energy_direction) {
        case 'increasing':
          particle.velocity.y += 0.01;
          break;
        case 'decreasing':
          particle.velocity.y -= 0.01;
          break;
      }

      // Volatility affects movement chaos
      const chaosForce = trends.volatility * 0.02;
      particle.velocity.add(new THREE.Vector3(
        (Math.random() - 0.5) * chaosForce,
        (Math.random() - 0.5) * chaosForce,
        (Math.random() - 0.5) * chaosForce
      ));
    }

    // Apply forces
    particle.velocity.add(energyDirection.multiplyScalar(energyForce));

    // Update position
    particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime * timing.baseSpeed * 60));

    // Apply boundary constraints
    const constraintResult = applyBoundaryConstraints(particle.position, particle.velocity);
    particle.position.copy(constraintResult.position);
    particle.velocity.copy(constraintResult.velocity);

    // Apply damping
    particle.velocity.multiplyScalar(0.98);
  };

  /**
   * Updates global scene effects
   */
  const updateSceneEffects = (
    group: THREE.Group,
    chunk: AudioChunkData,
    _analysis: AudioAnalysisMessage | null,
    elapsedTime: number
  ) => {
    // Rotate entire scene based on tempo
    const rotationSpeed = (chunk.tempo / 120) * 0.0005;
    group.rotation.y += rotationSpeed;

    // Scale scene slightly based on overall energy
    const scaleVariation = 1 + chunk.amplitude * 0.05;
    group.scale.setScalar(scaleVariation);

    // Add subtle breathing effect
    const breathScale = 1 + Math.sin(elapsedTime * 0.5) * 0.02;
    group.scale.multiplyScalar(breathScale);
  };

  // Render particles
  return (
    <group ref={groupRef}>
      {particlesRef.current.map((particle) => (
        <mesh
          key={particle.id}
          ref={(mesh) => {
            if (mesh) {
              particle.mesh = mesh;
              mesh.position.copy(particle.position);
            }
          }}
        >
          {/* Layer-specific geometry */}
          {particle.layer === 'foundation' && <boxGeometry args={[1, 1, 1]} />}
          {particle.layer === 'harmony' && <sphereGeometry args={[1, 12, 8]} />}
          {particle.layer === 'atmosphere' && <octahedronGeometry args={[1, 2]} />}
          
          <meshBasicMaterial 
            transparent 
            opacity={particle.opacity}
            color={particle.color}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Dynamic camera controller based on audio analysis
 */
function SynestheticCamera() {
  const { camera } = useThree();
  const { getChunkByTimestamp, getAnalysisByTimestamp } = useAppContext();
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audioElement = document.querySelector('audio') as HTMLAudioElement;
    if (audioElement) {
      audioElementRef.current = audioElement;
    }
  }, []);

  useFrame((state) => {
    if (!audioElementRef.current) return;

    const currentTime = audioElementRef.current.currentTime;
    const currentChunk = getChunkByTimestamp(currentTime);
    const currentAnalysis = getAnalysisByTimestamp(currentTime);

    if (!currentChunk) return;

    // Get camera movement based on audio analysis
    const cameraMovement = getCameraMovement(currentAnalysis, currentChunk, state.clock.elapsedTime);
    
    // Smooth camera transitions
    camera.position.lerp(cameraMovement.position, 0.02);
    camera.lookAt(cameraMovement.lookAt);
    
    // Update FOV only for perspective cameras
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, cameraMovement.fov, 0.05);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

/**
 * Scene lighting that responds to audio
 */
function SynestheticLighting() {
  const { getChunkByTimestamp } = useAppContext();
  const lightRef = useRef<THREE.PointLight>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audioElement = document.querySelector('audio') as HTMLAudioElement;
    if (audioElement) {
      audioElementRef.current = audioElement;
    }
  }, []);

  useFrame(() => {
    if (!lightRef.current || !audioElementRef.current) return;

    const currentTime = audioElementRef.current.currentTime;
    const chunk = getChunkByTimestamp(currentTime);
    
    if (!chunk) return;

    // Adjust light intensity based on amplitude
    lightRef.current.intensity = 0.5 + chunk.amplitude * 1.5;
    
    // Move light based on energy center
    const energyHeight = (chunk.energy_center / 20000) * 8;
    lightRef.current.position.y = energyHeight;
    
    // Color based on brightness
    const warmth = 1 - chunk.brightness;
    lightRef.current.color.setRGB(
      1,
      0.8 + warmth * 0.2,
      0.6 + warmth * 0.4
    );
  });

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight ref={lightRef} position={[0, 3, 0]} intensity={1} />
    </>
  );
}

/**
 * Complete visualizer scene
 */
function VisualizerScene() {
  return (
    <>
      <SynestheticCamera />
      <SynestheticLighting />
      <SynestheticVisualizer />
      
      {/* Background */}
      <mesh position={[0, 0, -20]} scale={[50, 50, 1]}>
        <planeGeometry />
        <meshBasicMaterial color="#0a0a0a" />
      </mesh>
    </>
  );
}

/**
 * Main AudioVisualizer component
 */
const AudioVisualizer: React.FC = () => {
  const { appState, loadingProgress } = useAppContext();

  // Show loading state
  if (!loadingProgress.isComplete) {
    return (
      <div className="w-full h-96 bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-400/20 flex items-center justify-center">
            <div className="w-8 h-8 bg-blue-400 rounded-full animate-pulse"></div>
          </div>
          <p className="text-gray-400">Loading audio data...</p>
          <p className="text-sm text-gray-500">
            {loadingProgress.chunks} chunks, {loadingProgress.analysis} analysis
          </p>
        </div>
      </div>
    );
  }

  // Always render Canvas once data is ready, but show overlay when not playing
  return (
    <div className="w-full h-full rounded-lg overflow-hidden bg-black relative">
      <Canvas 
        camera={{ position: [15, 5, 15], fov: 75 }} 
        gl={{ antialias: true, alpha: false }}
      >
        <VisualizerScene />
      </Canvas>
      
      {/* Show ready state overlay when not playing */}
      {appState !== APPSTATE.PLAYING && appState !== APPSTATE.PAUSED && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-400/20 flex items-center justify-center">
              <div className="w-8 h-8 bg-green-400 rounded-full"></div>
            </div>
            <p className="text-gray-400">Press play to start synesthetic visualization</p>
            <p className="text-sm text-gray-500">Ready for audio-visual synesthesia</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioVisualizer;