import React, { useState, useCallback } from 'react';
import type { UploadResponse } from '../types';

interface AudioUploadProps {
  onUploadSuccess: (response: UploadResponse) => void;
  onUploadError: (error: string) => void;
  isUploading: boolean;
  setIsUploading: (uploading: boolean) => void;
}

export const AudioUpload: React.FC<AudioUploadProps> = ({
  onUploadSuccess,
  onUploadError,
  isUploading,
  setIsUploading
}) => {
  const [dragOver, setDragOver] = useState(false);

  const uploadFile = useCallback(async (file: File) => {
    // Validar que sea MP3
    if (!file.name.toLowerCase().endsWith('.mp3')) {
      onUploadError('Solo se permiten archivos MP3');
      return;
    }

    // Validar tamaño (máximo 50MB)
    if (file.size > 50 * 1024 * 1024) {
      onUploadError('El archivo es demasiado grande (máximo 50MB)');
      return;
    }

    setIsUploading(true);

    try {
      // Crear FormData para enviar el archivo
      const formData = new FormData();
      formData.append('file', file);

      // Enviar al backend
      const response = await fetch('http://0.0.0.0:8000/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const result = await response.json();

      // Verificar si hay error en la respuesta
      if (result.error) {
        throw new Error(result.error);
      }

      // Éxito - llamar callback
      onUploadSuccess(result as UploadResponse);

    } catch (error) {
      console.error('Error subiendo archivo:', error);
      onUploadError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsUploading(false);
    }
  }, [onUploadSuccess, onUploadError, setIsUploading]);

  const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  }, [uploadFile]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  }, [uploadFile]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  }, []);

  return (
    <div className="w-full max-w-md mx-auto p-6">
      {/* Área de drag & drop */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isUploading ? (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-600">Subiendo archivo...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-6xl">🎵</div>
            <div>
              <p className="text-lg font-medium text-gray-700">
                Arrastra tu archivo MP3 aquí
              </p>
              <p className="text-sm text-gray-500 mt-2">
                o haz clic para seleccionar
              </p>
            </div>
            
            {/* Input file oculto */}
            <input
              type="file"
              accept=".mp3,audio/mpeg"
              onChange={handleFileInput}
              className="hidden"
              id="file-input"
              disabled={isUploading}
            />
            
            {/* Botón que activa el input */}
            <label
              htmlFor="file-input"
              className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
            >
              Seleccionar archivo
            </label>
          </div>
        )}
      </div>

      {/* Información adicional */}
      <div className="mt-4 text-sm text-gray-500 text-center">
        <p>Formatos soportados: MP3</p>
        <p>Tamaño máximo: 50MB</p>
      </div>
    </div>
  );
};