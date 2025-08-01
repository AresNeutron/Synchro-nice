import { useRef, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";
import type { AudioChunkData, VisualizerConfig } from "../types";
import { useAppContext } from "../hooks/useAppContext";

export const VisualizerScene = () => {
  const { chunks, currentTime, isPlaying } = useAppContext();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    particles: THREE.Points[];
    spheres: THREE.Mesh[];
    cubes: THREE.Mesh[];
    animationId: number | null;
  } | null>(null);

  // Configuración del visualizador
  const config: VisualizerConfig = useMemo(
    () => ({
      numParticles: 1000,
      bassRange: [0, 4], // Primeras 5 bandas para graves
      midRange: [5, 14], // 10 bandas para medios
      highRange: [15, 19], // Últimas 5 bandas para agudos
    }),
    []
  );

  // Inicializar escena Three.js
  const initScene = useCallback(() => {
    if (!canvasRef.current) return;

    // Crear escena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Fondo negro

    // Crear cámara
    const camera = new THREE.PerspectiveCamera(
      75, // FOV
      canvasRef.current.clientWidth / canvasRef.current.clientHeight, // Aspect ratio
      0.1, // Near plane
      1000 // Far plane
    );
    camera.position.z = 5; // Cámara fija frontal

    // Crear renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
    });
    renderer.setSize(
      canvasRef.current.clientWidth,
      canvasRef.current.clientHeight
    );

    // Crear sistema de partículas para efectos OSU-style
    const particles: THREE.Points[] = [];
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = config.numParticles;

    // Posiciones iniciales aleatorias de partículas
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10; // X
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10; // Y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5; // Z

      // Colores iniciales
      colors[i * 3] = Math.random(); // R
      colors[i * 3 + 1] = Math.random(); // G
      colors[i * 3 + 2] = Math.random(); // B
    }

    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    particleGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 3)
    );

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);
    particles.push(particleSystem);

    // Crear esferas para graves (bass)
    const spheres: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const sphereGeometry = new THREE.SphereGeometry(0.2, 16, 16);
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.6, 1, 0.5), // Azul para graves
        transparent: true,
        opacity: 0.7,
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

      // Posicionar esferas en círculo
      const angle = (i / 5) * Math.PI * 2;
      sphere.position.x = Math.cos(angle) * 2;
      sphere.position.y = Math.sin(angle) * 2;
      sphere.position.z = 0;

      scene.add(sphere);
      spheres.push(sphere);
    }

    // Crear cubos para agudos (treble)
    const cubes: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const cubeGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const cubeMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.1, 1, 0.5), // Amarillo para agudos
        transparent: true,
        opacity: 0.8,
      });
      const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

      // Posicionar cubos aleatoriamente
      cube.position.x = (Math.random() - 0.5) * 6;
      cube.position.y = (Math.random() - 0.5) * 6;
      cube.position.z = (Math.random() - 0.5) * 2;

      scene.add(cube);
      cubes.push(cube);
    }

    // Guardar referencias
    sceneRef.current = {
      scene,
      camera,
      renderer,
      particles,
      spheres,
      cubes,
      animationId: null,
    };
  }, [config.numParticles]);

  // Encontrar el chunk más cercano al tiempo actual
  const getCurrentChunk = useCallback((): AudioChunkData | null => {
    if (chunks.length === 0) return null;

    // Buscar el chunk cuyo timestamp sea más cercano al currentTime
    let closestChunk = chunks[0];
    let minDiff = Math.abs(closestChunk.timestamp - currentTime);

    for (const chunk of chunks) {
      const diff = Math.abs(chunk.timestamp - currentTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestChunk = chunk;
      }
    }

    // Solo devolver el chunk si está dentro de un rango razonable
    return minDiff <= 0.2 ? closestChunk : null;
  }, [chunks, currentTime]);

  // Actualizar visualización basada en datos de audio
  const updateVisualization = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene || !isPlaying) return;

    const currentChunk = getCurrentChunk();
    if (!currentChunk) return;

    // Calcular energías por rango de frecuencia
    const bassEnergy =
      currentChunk.frequencies
        .slice(config.bassRange[0], config.bassRange[1] + 1)
        .reduce((sum, freq) => sum + freq, 0) /
      (config.bassRange[1] - config.bassRange[0] + 1);

    const midEnergy =
      currentChunk.frequencies
        .slice(config.midRange[0], config.midRange[1] + 1)
        .reduce((sum, freq) => sum + freq, 0) /
      (config.midRange[1] - config.midRange[0] + 1);

    const highEnergy =
      currentChunk.frequencies
        .slice(config.highRange[0], config.highRange[1] + 1)
        .reduce((sum, freq) => sum + freq, 0) /
      (config.highRange[1] - config.highRange[0] + 1);

    // Actualizar esferas (graves)
    scene.spheres.forEach((sphere) => {
      const scale = 1 + bassEnergy * 3; // Escalar según energía de graves
      sphere.scale.setScalar(scale);

      // Rotar si hay percusión
      if (currentChunk.is_percussive) {
        sphere.rotation.x += 0.1;
        sphere.rotation.y += 0.1;
      }

      // Cambiar color según brillo
      const material = sphere.material as THREE.MeshBasicMaterial;
      material.color.setHSL(0.6, 1, 0.3 + currentChunk.brightness * 0.4);
    });

    // Actualizar cubos (agudos)
    scene.cubes.forEach((cube) => {
      const scale = 1 + highEnergy * 2;
      cube.scale.setScalar(scale);

      // Movimiento más errático para agudos
      cube.rotation.x += highEnergy * 0.2;
      cube.rotation.y += highEnergy * 0.15;
      cube.rotation.z += highEnergy * 0.1;

      // Color más brillante con agudos
      const material = cube.material as THREE.MeshBasicMaterial;
      material.color.setHSL(0.1, 1, 0.3 + highEnergy * 0.5);
    });

    // Actualizar partículas
    scene.particles.forEach((particleSystem) => {
      const positions = particleSystem.geometry.attributes.position
        .array as Float32Array;
      const colors = particleSystem.geometry.attributes.color
        .array as Float32Array;

      for (let i = 0; i < positions.length / 3; i++) {
        // Movimiento basado en energía media
        const movement = midEnergy * 0.1;
        positions[i * 3] += (Math.random() - 0.5) * movement; // X
        positions[i * 3 + 1] += (Math.random() - 0.5) * movement; // Y

        // Explotar partículas si hay percusión
        if (currentChunk.is_percussive) {
          const explosion = 0.3;
          positions[i * 3] += (Math.random() - 0.5) * explosion;
          positions[i * 3 + 1] += (Math.random() - 0.5) * explosion;
          positions[i * 3 + 2] += (Math.random() - 0.5) * explosion;
        }

        // Actualizar colores basado en frecuencias
        colors[i * 3] = bassEnergy; // R para graves
        colors[i * 3 + 1] = midEnergy; // G para medios
        colors[i * 3 + 2] = highEnergy; // B para agudos
      }

      // Marcar atributos como necesitando actualización
      particleSystem.geometry.attributes.position.needsUpdate = true;
      particleSystem.geometry.attributes.color.needsUpdate = true;
    });
  }, [getCurrentChunk, isPlaying, config]);

  // Loop de animación
  const animate = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Actualizar visualización con datos de audio
    updateVisualization();

    // Renderizar escena
    scene.renderer.render(scene.scene, scene.camera);

    // Programar siguiente frame
    scene.animationId = requestAnimationFrame(animate);
  }, [updateVisualization]);

  // Inicializar escena al montar
  useEffect(() => {
    initScene();

    return () => {
      // Limpiar al desmontar
      const scene = sceneRef.current;
      if (scene) {
        if (scene.animationId) {
          cancelAnimationFrame(scene.animationId);
        }
        scene.renderer.dispose();
      }
    };
  }, [initScene]);

  // Iniciar/parar animación según estado de reproducción
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (isPlaying) {
      animate();
    } else {
      if (scene.animationId) {
        cancelAnimationFrame(scene.animationId);
        scene.animationId = null;
      }
    }
  }, [isPlaying, animate]);

  // Manejar redimensionamiento
  useEffect(() => {
    const handleResize = () => {
      const scene = sceneRef.current;
      const canvas = canvasRef.current;
      if (!scene || !canvas) return;

      scene.camera.aspect = canvas.clientWidth / canvas.clientHeight;
      scene.camera.updateProjectionMatrix();
      scene.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ background: "#000000" }}
      />
    </div>
  );
};
