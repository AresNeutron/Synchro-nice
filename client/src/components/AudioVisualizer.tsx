import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useAppContext } from '../hooks/useAppContext';
import type { AudioChunkData } from '../types';

interface AudioVisualizerProps {
  audioRef: React.RefObject<HTMLAudioElement>;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ audioRef }) => {
  // Referencia al elemento canvas para Three.js
  const mountRef = useRef<HTMLDivElement>(null);
  // Referencia para la escena, cámara y renderizador de Three.js
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  // Referencia para el objeto 3D que visualizaremos
  const visualObjectRef = useRef<THREE.Mesh | null>(null);

  // Acceso al contexto de la aplicación para obtener los chunks de audio
  const { chunks } = useAppContext()

  // Estado para mantener el índice del chunk actual que se está visualizando
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);

  // useEffect para inicializar la escena de Three.js
  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Configuración de la escena
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a0a0a); // Fondo oscuro

    // 2. Configuración de la cámara
    const camera = new THREE.PerspectiveCamera(
      75, // Campo de visión
      mountRef.current.clientWidth / mountRef.current.clientHeight, // Aspect ratio
      0.1, // Near clipping plane
      1000 // Far clipping plane
    );
    camera.position.z = 5; // Posición inicial de la cámara
    cameraRef.current = camera;

    // 3. Configuración del renderizador
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);

    // 4. Añadir un objeto 3D a la escena (una esfera como visualizador)
    const geometry = new THREE.SphereGeometry(1, 32, 32); // Radio, segmentos de ancho, segmentos de alto
    const material = new THREE.MeshBasicMaterial({ color: 0x0077ff }); // Color azul inicial
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    visualObjectRef.current = sphere;

    // 5. Añadir una luz ambiental para que el objeto sea visible
    const ambientLight = new THREE.AmbientLight(0x404040); // Luz suave
    scene.add(ambientLight);

    // 6. Añadir una luz direccional para dar más forma
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    // Función para manejar el redimensionamiento de la ventana
    const handleResize = () => {
      if (mountRef.current && cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    // Función de limpieza al desmontar el componente
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(renderer.domElement);
        rendererRef.current.dispose(); // Libera los recursos del renderizador
      }
    };
  }, []); // El array vacío asegura que este efecto se ejecute solo una vez al montar

  // useEffect para la lógica de animación y sincronización
  useEffect(() => {
    const animate = () => {
      const audio = audioRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      const visualObject = visualObjectRef.current;

      if (!audio || !scene || !camera || !renderer || !visualObject) {
        requestAnimationFrame(animate);
        return;
      }

      // Obtener el tiempo actual de reproducción del audio
      const currentTime = audio.currentTime;

      // Buscar el chunk de audio relevante
      // Avanzamos el índice solo si el timestamp del chunk actual ya ha pasado
      let nextChunkIndex = currentChunkIndex;
      while (nextChunkIndex < chunks.length && chunks[nextChunkIndex].timestamp < currentTime) {
        nextChunkIndex++;
      }

      // Si hemos avanzado el índice, actualizamos el estado
      if (nextChunkIndex !== currentChunkIndex) {
        setCurrentChunkIndex(nextChunkIndex);
      }

      // Usar el chunk actual para actualizar la visualización
      const activeChunk: AudioChunkData | null = chunks[currentChunkIndex] || null;

      if (activeChunk) {
        // Ejemplo de visualización:
        // 1. Cambiar el tamaño de la esfera según la amplitud
        const scale = 1 + activeChunk.amplitude * 2; // La amplitud va de 0 a 1, así que escalamos
        visualObject.scale.set(scale, scale, scale);

        // 2. Cambiar el color de la esfera según la energía en las frecuencias
        // Mapeamos las frecuencias a un color. Por ejemplo, más energía = color más vibrante.
        // Aquí usamos una interpolación simple de color basada en la amplitud general
        const colorIntensity = activeChunk.amplitude;
        const baseColor = new THREE.Color(0x0077ff); // Azul
        const peakColor = new THREE.Color(0xff0000); // Rojo
        const interpolatedColor = baseColor.clone().lerp(peakColor, colorIntensity);
        (visualObject.material as THREE.MeshBasicMaterial).color.copy(interpolatedColor);

        // Opcional: Rotar el objeto según el tempo o la energía
        visualObject.rotation.x += (activeChunk.tempo / 1200) * 0.01; // Velocidad de rotación basada en tempo
        visualObject.rotation.y += (activeChunk.energy_center / 10000) * 0.01; // Velocidad de rotación basada en energy_center
      } else {
        // Si no hay chunk activo (ej. al inicio o final), restablecer la visualización
        visualObject.scale.set(1, 1, 1);
        (visualObject.material as THREE.MeshBasicMaterial).color.set(0x0077ff);
      }

      // Renderizar la escena
      renderer.render(scene, camera);

      // Solicitar el siguiente fotograma de animación
      requestAnimationFrame(animate);
    };

    // Iniciar el bucle de animación
    const animationFrameId = requestAnimationFrame(animate);

    // Limpieza: detener el bucle de animación al desmontar el componente
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [chunks, audioRef, currentChunkIndex]); // Dependencias: chunks y audioRef para que el efecto se re-ejecute si cambian

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '500px', background: '#000', borderRadius: '8px', overflow: 'hidden' }}
    >
      {/* El canvas de Three.js se montará aquí */}
    </div>
  );
};

export default AudioVisualizer;