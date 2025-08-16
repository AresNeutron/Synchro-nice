import * as THREE from "three";
import type { AudioChunkData } from "../types";

// Musical note to color mapping (12-tone chromatic scale)
const CHROMATIC_COLORS = [
  { note: "C", hue: 0.0, name: "red" },      // C - Red (root)
  { note: "C#", hue: 0.083, name: "orange" }, // C# - Orange
  { note: "D", hue: 0.167, name: "yellow" },  // D - Yellow
  { note: "D#", hue: 0.25, name: "lime" },    // D# - Lime
  { note: "E", hue: 0.33, name: "green" },    // E - Green
  { note: "F", hue: 0.417, name: "cyan" },    // F - Cyan
  { note: "F#", hue: 0.5, name: "blue" },     // F# - Blue
  { note: "G", hue: 0.583, name: "purple" },  // G - Purple
  { note: "G#", hue: 0.667, name: "magenta" }, // G# - Magenta
  { note: "A", hue: 0.75, name: "pink" },     // A - Pink
  { note: "A#", hue: 0.833, name: "rose" },   // A# - Rose
  { note: "B", hue: 0.917, name: "crimson" }  // B - Crimson
];

/**
 * Maps chroma features to a dominant color based on musical harmony
 */
export function getChromaColor(chromaFeatures: number[]): { hue: number; strength: number } {
  if (chromaFeatures.length !== 12) {
    return { hue: 0, strength: 0 };
  }

  // Find dominant note(s)
  const maxChroma = Math.max(...chromaFeatures);
  const dominantIndex = chromaFeatures.indexOf(maxChroma);
  
  if (maxChroma === 0) {
    return { hue: 0, strength: 0 };
  }

  // Get primary hue from dominant note
  const primaryHue = CHROMATIC_COLORS[dominantIndex].hue;
  
  // Calculate harmonic blend if there are secondary strong notes
  let blendedHue = primaryHue;
  let totalStrength = maxChroma;
  
  chromaFeatures.forEach((strength, index) => {
    if (index !== dominantIndex && strength > maxChroma * 0.6) {
      // Blend with secondary strong notes
      const weight = strength / maxChroma;
      blendedHue = (blendedHue + CHROMATIC_COLORS[index].hue * weight) / (1 + weight);
      totalStrength += strength * weight;
    }
  });

  return {
    hue: blendedHue % 1, // Ensure hue stays in 0-1 range
    strength: Math.min(totalStrength, 1)
  };
}

/**
 * Creates a synesthetic color based on multiple audio features
 */
export function createSynestheticColor(chunk: AudioChunkData): THREE.Color {
  const chromaColor = getChromaColor(chunk.chroma_features);
  
  // Base hue from musical harmony
  let hue = chromaColor.hue;
  
  // Modify hue based on brightness (spectral centroid)
  // Bright sounds shift toward cooler colors, dark sounds toward warmer
  const brightnessShift = (chunk.brightness - 0.5) * 0.2; // ±0.1 hue shift
  hue = (hue + brightnessShift + 1) % 1;
  
  // Saturation based on spectral flatness
  // Tonal sounds = high saturation, noisy sounds = low saturation
  const saturation = 0.3 + (1 - chunk.spectral_flatness) * 0.7;
  
  // Lightness based on amplitude and chroma strength
  const baseLightness = 0.4 + chunk.amplitude * 0.4;
  const chromaBoost = chromaColor.strength * 0.2;
  const lightness = Math.min(baseLightness + chromaBoost, 0.9);
  
  return new THREE.Color().setHSL(hue, saturation, lightness);
}

/**
 * Maps frequency bands to vertical position (spatial synesthesia)
 */
export function getFrequencyHeight(frequencyBand: number, totalBands: number = 20): number {
  // Low frequencies at bottom (-5 to -2), mids in center (-2 to 2), highs at top (2 to 8)
  const normalizedBand = frequencyBand / (totalBands - 1); // 0 to 1
  return -5 + normalizedBand * 13; // -5 to 8 range
}

/**
 * Gets color temperature based on brightness (warm = low brightness, cool = high brightness)
 */
export function getTemperatureColor(brightness: number): THREE.Color {
  // Warm (red/orange) for low brightness, cool (blue/cyan) for high brightness
  const hue = (1 - brightness) * 0.15; // 0.15 (orange) to 0.0 (red) for warm, inverted for cool
  const coolHue = 0.5 + brightness * 0.17; // 0.5 (cyan) to 0.67 (blue) for cool
  
  const finalHue = brightness < 0.5 ? hue : coolHue;
  const saturation = 0.6 + Math.abs(brightness - 0.5) * 0.4; // More saturated at extremes
  const lightness = 0.5;
  
  return new THREE.Color().setHSL(finalHue, saturation, lightness);
}

/**
 * Creates a percussive impact color (bright, saturated burst)
 */
export function getPercussiveColor(baseColor: THREE.Color, beatStrength: number): THREE.Color {
  const impactColor = baseColor.clone();
  const hsl = { h: 0, s: 0, l: 0 };
  impactColor.getHSL(hsl);
  
  // Increase saturation and lightness for percussive hits
  hsl.s = Math.min(hsl.s + beatStrength * 0.3, 1);
  hsl.l = Math.min(hsl.l + beatStrength * 0.4, 0.95);
  
  return impactColor.setHSL(hsl.h, hsl.s, hsl.l);
}