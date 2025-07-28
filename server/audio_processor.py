import librosa
import numpy as np
from typing import List, Generator
import soundfile as sf
from typing import Tuple
from models.models import AudioChunkData, AudioFileInfo

class AudioProcessor:
    def __init__(self, chunk_duration: float = 0.2):
        self.chunk_duration = chunk_duration  # Duración de cada chunk en segundos
        self.n_fft = 2048  # Tamaño de ventana para FFT (análisis de frecuencias)
        self.hop_length = 512  # Salto entre ventanas para análisis
        self.n_frequency_bands = 20  # Número de bandas de frecuencia que extraemos
    
    def load_audio(self, file_path: str) -> Tuple[AudioFileInfo, np.ndarray, int | float]:
        """Carga el archivo de audio y extrae información básica"""
        # Cargar audio con librosa (convierte automáticamente a mono si es estéreo)
        y, sr = librosa.load(file_path, sr=None)  # sr=None preserva la frecuencia original
        
        # Obtener información del archivo usando soundfile
        info = sf.info(file_path)
        
        return AudioFileInfo(
            filename=file_path.split('/')[-1],
            duration=len(y) / sr,  # Duración = muestras / frecuencia_muestreo
            sample_rate=sr,
            channels=info.channels,
            file_path=file_path
        ), y, sr
    
    def process_chunks(self, audio_data: np.ndarray, sample_rate: int) -> Generator[AudioChunkData, None, None]:
        """Procesa el audio en chunks y genera los datos para visualización"""
        # Calcular número de muestras por chunk
        chunk_samples = int(self.chunk_duration * sample_rate)
        total_samples = len(audio_data)
        
        # Procesar chunk por chunk
        for i in range(0, total_samples, chunk_samples):
            # Extraer el chunk actual
            chunk = audio_data[i:i + chunk_samples]
            
            # Si el chunk es muy pequeño, rellenarlo con ceros
            if len(chunk) < chunk_samples:
                chunk = np.pad(chunk, (0, chunk_samples - len(chunk)))
            
            # Calcular timestamp del chunk
            timestamp = i / sample_rate
            
            # Procesar el chunk y extraer características
            chunk_data = self._analyze_chunk(chunk, sample_rate, timestamp)
            
            yield chunk_data
    
    def _analyze_chunk(self, chunk: np.ndarray, sample_rate: int, timestamp: float) -> AudioChunkData:
        """Analiza un chunk individual y extrae todas las características"""
        
        # 1. Calcular espectrograma usando STFT (Short-Time Fourier Transform)
        stft = librosa.stft(chunk, n_fft=self.n_fft, hop_length=self.hop_length)
        magnitude = np.abs(stft)  # Magnitud del espectrograma
        
        # 2. Dividir el espectro en bandas de frecuencia
        frequencies = self._extract_frequency_bands(magnitude, sample_rate)
        
        # 3. Calcular amplitud general (RMS - Root Mean Square)
        amplitude = librosa.feature.rms(y=chunk)[0, 0]  # Energía promedio del chunk
        amplitude = float(np.clip(amplitude, 0, 1))  # Normalizar entre 0 y 1
        
        # 4. Calcular centroide espectral (brillo del sonido)
        spectral_centroids = librosa.feature.spectral_centroid(y=chunk, sr=sample_rate)[0]
        brightness = float(spectral_centroids[0] / (sample_rate / 2))  # Normalizar
        
        # 5. Calcular rolloff espectral (dónde se concentra la energía)
        rolloff = librosa.feature.spectral_rolloff(y=chunk, sr=sample_rate)[0, 0]
        energy_center = float(rolloff)
        
        # 6. Detectar elementos percusivos usando onset detection
        onset_frames = librosa.onset.onset_detect(y=chunk, sr=sample_rate, units='frames')
        is_percussive = len(onset_frames) > 0  # Si hay onset, es percusivo
        
        # 7. Calcular zero crossing rate (para detectar ruido vs tonos)
        zcr = librosa.feature.zero_crossing_rate(chunk)[0, 0]
        zero_crossing_rate = float(zcr)
        
        return AudioChunkData(
            timestamp=timestamp,
            frequencies=frequencies,
            amplitude=amplitude,
            brightness=brightness,
            energy_center=energy_center,
            is_percussive=is_percussive,
            rolloff=float(rolloff),
            zero_crossing_rate=zero_crossing_rate
        )
    
    def _extract_frequency_bands(self, magnitude: np.ndarray, sample_rate: int) -> List[float]:
        """Divide el espectro en bandas de frecuencia y calcula la energía de cada banda"""
        # Crear límites de frecuencia logarítmicos (más resolución en graves)
        freq_bins = np.logspace(np.log10(20), np.log10(sample_rate/2), self.n_frequency_bands + 1)
        
        # Convertir frecuencias a índices del espectrograma
        fft_freqs = librosa.fft_frequencies(sr=sample_rate, n_fft=self.n_fft)
        
        band_energies = []
        
        for i in range(self.n_frequency_bands):
            # Encontrar índices correspondientes a esta banda
            low_freq = freq_bins[i]
            high_freq = freq_bins[i + 1]
            
            # Encontrar bins del FFT que caen en esta banda
            low_bin = np.argmax(fft_freqs >= low_freq)
            high_bin = np.argmax(fft_freqs >= high_freq)
            
            if high_bin == 0:  # Si no encontró, usar el último bin
                high_bin = len(fft_freqs) - 1
            
            # Calcular energía promedio en esta banda
            band_magnitude = magnitude[low_bin:high_bin, :]
            if band_magnitude.size > 0:
                energy = float(np.mean(band_magnitude))
            else:
                energy = 0.0
            
            band_energies.append(energy)
        
        # Normalizar las energías para que estén entre 0 y 1
        max_energy = max(band_energies) if max(band_energies) > 0 else 1
        return [energy / max_energy for energy in band_energies]