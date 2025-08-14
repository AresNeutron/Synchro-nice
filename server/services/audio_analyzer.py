import numpy as np
from typing import List, Dict, Any, Optional
from collections import deque
from scipy import stats
from scipy.signal import find_peaks
import warnings
from models.models import (
    AudioChunkData, TransitionAnalysis, TrendAnalysis, 
    PatternAnalysis, PredictionAnalysis, AudioRelationships
)

class AudioAnalyzer:
    def __init__(self, analysis_window_size: int = 25):
        self.analysis_window_size = analysis_window_size  # 25 chunks = 5 segundos
        self.transition_window = 5  # Para análisis de transiciones
        
        # Buffer completo para detección de patrones a largo plazo
        self.full_buffer: List[AudioChunkData] = []
        
        # Buffer circular para análisis de ventana
        self.window_buffer: deque = deque(maxlen=analysis_window_size)
        
    def add_chunk(self, chunk: AudioChunkData) -> None:
        """Añade un nuevo chunk a los buffers"""
        self.full_buffer.append(chunk)
        self.window_buffer.append(chunk)
    
    def analyze_relationships(self) -> Optional[AudioRelationships]:
        """Analiza las relaciones entre chunks. Solo funciona con suficientes datos."""
        if len(self.window_buffer) < 2:
            return None
            
        return AudioRelationships(
            transitions=self._analyze_transitions(),
            trends=self._analyze_trends(),
            patterns=self._analyze_patterns(),
            predictions=self._make_predictions(),
            analysis_window_size=len(self.window_buffer),
            buffer_size=len(self.full_buffer)
        )
    
    def _analyze_transitions(self) -> TransitionAnalysis:
        """Analiza transiciones entre chunks recientes"""
        if len(self.window_buffer) < 2:
            return self._default_transition_analysis()
        
        # Obtener últimos chunks para análisis de transiciones
        recent_chunks: List[AudioChunkData] = list(self.window_buffer)[-min(self.transition_window, len(self.window_buffer)):]
        
        if len(recent_chunks) < 2:
            return self._default_transition_analysis()
        
        current = recent_chunks[-1]
        previous = recent_chunks[-2]
        
        # Calcular deltas
        amplitude_delta = current.amplitude - previous.amplitude
        brightness_delta = current.brightness - previous.brightness
        beat_strength_delta = current.beat_strength - previous.beat_strength
        
        # Deltas de frecuencias
        frequency_deltas = [
            curr_freq - prev_freq 
            for curr_freq, prev_freq in zip(current.frequencies, previous.frequencies)
        ]
        
        # Calcular suavidad de transición
        transition_smoothness = self._calculate_transition_smoothness(recent_chunks)
        
        # Calcular velocidad de cambio
        change_velocity = self._calculate_change_velocity(recent_chunks)
        
        # Determinar dirección energética
        energy_direction = self._determine_energy_direction(recent_chunks)
        
        return TransitionAnalysis(
            amplitude_delta=amplitude_delta,
            brightness_delta=brightness_delta,
            beat_strength_delta=beat_strength_delta,
            frequency_deltas=frequency_deltas,
            transition_smoothness=transition_smoothness,
            change_velocity=change_velocity,
            energy_direction=energy_direction
        )
    
    def _analyze_trends(self) -> TrendAnalysis:
        """Analiza tendencias en la ventana completa"""
        if len(self.window_buffer) < 3:
            return self._default_trend_analysis()
        
        chunks: List[AudioChunkData] = list(self.window_buffer)
        
        # Extraer series temporales
        amplitudes = [chunk.amplitude for chunk in chunks]
        brightnesses = [chunk.brightness for chunk in chunks]
        beat_strengths = [chunk.beat_strength for chunk in chunks]
        
        # Calcular tendencias usando regresión lineal
        x = np.arange(len(chunks))
        
        amplitude_trend = self._calculate_trend(x, amplitudes)
        brightness_trend = self._calculate_trend(x, brightnesses)
        beat_strength_trend = self._calculate_trend(x, beat_strengths)
        
        # Tendencias por banda de frecuencia
        frequency_trends = []
        for i in range(len(chunks[0].frequencies)):
            freq_series = [chunk.frequencies[i] for chunk in chunks]
            trend = self._calculate_trend(x, freq_series)
            frequency_trends.append(trend)
        
        # Calcular métricas generales
        overall_energy_trend = self._calculate_overall_energy_trend(chunks)
        trend_strength = self._calculate_trend_strength(chunks)
        volatility = self._calculate_volatility(chunks)
        
        return TrendAnalysis(
            amplitude_trend=amplitude_trend,
            brightness_trend=brightness_trend,
            beat_strength_trend=beat_strength_trend,
            frequency_trends=frequency_trends,
            overall_energy_trend=overall_energy_trend,
            trend_strength=trend_strength,
            volatility=volatility
        )
    
    def _analyze_patterns(self) -> PatternAnalysis:
        """Analiza patrones cíclicos en el buffer completo"""
        if len(self.full_buffer) < 8:  # Necesitamos al menos 8 chunks para patrones
            return PatternAnalysis(
                detected_patterns=[],
                pattern_strength=0.0,
                cycle_length=None,
                pattern_confidence=0.0
            )
        
        detected_patterns = self._detect_cyclic_patterns()
        pattern_strength = self._calculate_pattern_strength()
        cycle_length = self._find_dominant_cycle_length()
        pattern_confidence = self._calculate_pattern_confidence()
        
        return PatternAnalysis(
            detected_patterns=detected_patterns,
            pattern_strength=pattern_strength,
            cycle_length=cycle_length,
            pattern_confidence=pattern_confidence
        )
    
    def _make_predictions(self) -> PredictionAnalysis:
        """Hace predicciones basadas en las tendencias actuales"""
        if len(self.window_buffer) < 3:
            return self._default_prediction_analysis()
        
        chunks = list(self.window_buffer)
        
        # Predicciones basadas en extrapolación de tendencias
        predicted_amplitude = self._extrapolate_trend([c.amplitude for c in chunks])
        predicted_brightness = self._extrapolate_trend([c.brightness for c in chunks])
        predicted_beat_strength = self._extrapolate_trend([c.beat_strength for c in chunks])
        
        # Predicción de cambio energético
        predicted_energy_change = self._predict_energy_change(chunks)
        
        # Calcular probabilidades de eventos
        drop_probability = self._calculate_drop_probability(chunks)
        buildup_probability = self._calculate_buildup_probability(chunks)
        break_probability = self._calculate_break_probability(chunks)
        
        return PredictionAnalysis(
            predicted_amplitude=predicted_amplitude,
            predicted_brightness=predicted_brightness,
            predicted_beat_strength=predicted_beat_strength,
            predicted_energy_change=predicted_energy_change,
            drop_probability=drop_probability,
            buildup_probability=buildup_probability,
            break_probability=break_probability
        )
    
    # Métodos auxiliares
    
    def _calculate_trend(self, x: np.ndarray, y: List[float]) -> float:
        """Calcula la pendiente de regresión lineal normalizada"""
        if len(y) < 2:
            return 0.0
        
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            slope, _, r_value, _, _ = stats.linregress(x, y)
        
        # Normalizar la pendiente considerando el rango de datos
        y_range = max(y) - min(y)
        if y_range == 0:
            return 0.0
        
        # Normalizar entre -1 y 1
        normalized_slope = np.clip(slope * len(x) / y_range, -1, 1)
        return float(normalized_slope)
    
    def _calculate_transition_smoothness(self, chunks: List[AudioChunkData]) -> float:
        """Calcula qué tan suave es la transición"""
        if len(chunks) < 2:
            return 1.0
        
        # Calcular varianza de los cambios consecutivos
        changes = []
        for i in range(1, len(chunks)):
            change = abs(chunks[i].amplitude - chunks[i-1].amplitude)
            changes.append(change)
        
        if not changes:
            return 1.0
        
        # Menor varianza = más suave
        variance = np.var(changes)
        smoothness = 1.0 / (1.0 + variance * 10)  # Normalizar
        return float(np.clip(smoothness, 0.0, 1.0))
    
    def _calculate_change_velocity(self, chunks: List[AudioChunkData]) -> float:
        """Calcula la velocidad del cambio"""
        if len(chunks) < 3:
            return 0.0
        
        # Calcular aceleración (cambio de cambio)
        velocities = []
        for i in range(1, len(chunks) - 1):
            prev_change = chunks[i].amplitude - chunks[i-1].amplitude
            curr_change = chunks[i+1].amplitude - chunks[i].amplitude
            acceleration = abs(curr_change - prev_change)
            velocities.append(acceleration)
        
        return float(np.mean(velocities)) if velocities else 0.0
    
    def _determine_energy_direction(self, chunks: List[AudioChunkData]) -> str:
        """Determina la dirección del cambio energético"""
        if len(chunks) < 2:
            return "stable"
        
        recent_trend = chunks[-1].amplitude - chunks[0].amplitude
        
        if recent_trend > 0.05:
            return "increasing"
        elif recent_trend < -0.05:
            return "decreasing"
        else:
            return "stable"
    
    def _calculate_overall_energy_trend(self, chunks: List[AudioChunkData]) -> float:
        """Calcula tendencia energética general combinando múltiples métricas"""
        if len(chunks) < 2:
            return 0.0
        
        # Combinar amplitud, brightness y beat_strength
        energy_scores = []
        for chunk in chunks:
            energy = (chunk.amplitude + chunk.brightness + chunk.beat_strength) / 3.0
            energy_scores.append(energy)
        
        x = np.arange(len(energy_scores))
        return self._calculate_trend(x, energy_scores)
    
    def _calculate_trend_strength(self, chunks: List[AudioChunkData]) -> float:
        """Calcula qué tan fuerte es la tendencia general"""
        if len(chunks) < 3:
            return 0.0
        
        amplitudes = [chunk.amplitude for chunk in chunks]
        x = np.arange(len(amplitudes))
        
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            _, _, r_value, _, _ = stats.linregress(x, amplitudes)
        
        return float(abs(r_value)) if not np.isnan(r_value) else 0.0
    
    def _calculate_volatility(self, chunks: List[AudioChunkData]) -> float:
        """Calcula la volatilidad (variabilidad) de la música"""
        if len(chunks) < 2:
            return 0.0
        
        amplitudes = [chunk.amplitude for chunk in chunks]
        return float(np.std(amplitudes))
    
    def _extrapolate_trend(self, values: List[float]) -> float:
        """Extrapola una tendencia para predecir próximo valor"""
        if len(values) < 2:
            return values[0] if values else 0.0
        
        x = np.arange(len(values))
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            slope, intercept, _, _, _ = stats.linregress(x, values)
        
        # Predecir próximo valor
        next_x = len(values)
        predicted = slope * next_x + intercept
        
        return float(np.clip(predicted, 0.0, 1.0))
    
    def _predict_energy_change(self, chunks: List[AudioChunkData]) -> str:
        """Predice el tipo de cambio energético que viene"""
        if len(chunks) < 5:
            return "stable"
        
        recent_trend = self._calculate_overall_energy_trend(chunks[-5:])
        current_energy = chunks[-1].amplitude
        
        if recent_trend > 0.3 and current_energy > 0.7:
            return "drop"
        elif recent_trend > 0.1:
            return "buildup"
        elif recent_trend < -0.2:
            return "breakdown"
        else:
            return "stable"
    
    def _calculate_drop_probability(self, chunks: List[AudioChunkData]) -> float:
        """Calcula probabilidad de drop inminente"""
        if len(chunks) < 5:
            return 0.0
        
        # Criterios: energía alta + tendencia creciente + beat fuerte
        recent = chunks[-3:]
        avg_amplitude = np.mean([c.amplitude for c in recent])
        avg_beat = np.mean([c.beat_strength for c in recent])
        trend = self._calculate_overall_energy_trend(chunks)
        
        probability = 0.0
        if avg_amplitude > 0.7:
            probability += 0.3
        if avg_beat > 0.6:
            probability += 0.3
        if trend > 0.2:
            probability += 0.4
        
        return float(np.clip(probability, 0.0, 1.0))
    
    def _calculate_buildup_probability(self, chunks: List[AudioChunkData]) -> float:
        """Calcula probabilidad de buildup"""
        if len(chunks) < 3:
            return 0.0
        
        trend = self._calculate_overall_energy_trend(chunks)
        return float(np.clip(trend, 0.0, 1.0))
    
    def _calculate_break_probability(self, chunks: List[AudioChunkData]) -> float:
        """Calcula probabilidad de break/pausa"""
        if len(chunks) < 3:
            return 0.0
        
        recent_amplitude = chunks[-1].amplitude
        trend = self._calculate_overall_energy_trend(chunks)
        
        if recent_amplitude < 0.3 and trend < -0.1:
            return float(np.clip(abs(trend), 0.0, 1.0))
        return 0.0
    
    # Métodos para análisis de patrones (implementación básica)
    
    def _detect_cyclic_patterns(self) -> List[Dict[str, Any]]:
        """Detecta patrones cíclicos básicos"""
        patterns = []
        
        if len(self.full_buffer) < 16:
            return patterns
        
        # Buscar patrones en amplitud
        amplitudes = [chunk.amplitude for chunk in self.full_buffer[-40:]]  # Últimos 8 segundos
        
        # Buscar picos para detectar patrones rítmicos
        peaks, _ = find_peaks(amplitudes, height=np.mean(amplitudes), distance=2)
        
        if len(peaks) >= 3:
            # Calcular distancias entre picos
            distances = np.diff(peaks)
            if len(distances) > 1:
                avg_distance = np.mean(distances)
                pattern = {
                    "type": "rhythmic",
                    "period": float(avg_distance * 0.2),  # Convertir a segundos
                    "strength": float(np.std(distances) < 1.0),  # Regularidad
                    "last_occurrence": float(peaks[-1] * 0.2)
                }
                patterns.append(pattern)
        
        return patterns
    
    def _calculate_pattern_strength(self) -> float:
        """Calcula la fuerza general de los patrones"""
        patterns = self._detect_cyclic_patterns()
        if not patterns:
            return 0.0
        return float(np.mean([p.get("strength", 0.0) for p in patterns]))
    
    def _find_dominant_cycle_length(self) -> Optional[int]:
        """Encuentra la longitud del ciclo dominante"""
        patterns = self._detect_cyclic_patterns()
        if not patterns:
            return None
        
        # Retornar el ciclo más fuerte
        strongest = max(patterns, key=lambda p: p.get("strength", 0.0))
        period_seconds = strongest.get("period", 0.0)
        return int(period_seconds / 0.2) if period_seconds > 0 else None
    
    def _calculate_pattern_confidence(self) -> float:
        """Calcula confianza en la detección de patrones"""
        patterns = self._detect_cyclic_patterns()
        if not patterns:
            return 0.0
        
        # Confianza basada en número y fuerza de patrones
        strength_sum = sum(p.get("strength", 0.0) for p in patterns)
        pattern_count = len(patterns)
        
        confidence = (strength_sum / max(pattern_count, 1)) * min(pattern_count / 3.0, 1.0)
        return float(np.clip(confidence, 0.0, 1.0))
    
    # Métodos por defecto para casos con pocos datos
    
    def _default_transition_analysis(self) -> TransitionAnalysis:
        return TransitionAnalysis(
            amplitude_delta=0.0,
            brightness_delta=0.0,
            beat_strength_delta=0.0,
            frequency_deltas=[0.0] * 20,
            transition_smoothness=1.0,
            change_velocity=0.0,
            energy_direction="stable"
        )
    
    def _default_trend_analysis(self) -> TrendAnalysis:
        return TrendAnalysis(
            amplitude_trend=0.0,
            brightness_trend=0.0,
            beat_strength_trend=0.0,
            frequency_trends=[0.0] * 20,
            overall_energy_trend=0.0,
            trend_strength=0.0,
            volatility=0.0
        )
    
    def _default_prediction_analysis(self) -> PredictionAnalysis:
        return PredictionAnalysis(
            predicted_amplitude=0.5,
            predicted_brightness=0.5,
            predicted_beat_strength=0.5,
            predicted_energy_change="stable",
            drop_probability=0.0,
            buildup_probability=0.0,
            break_probability=0.0
        )