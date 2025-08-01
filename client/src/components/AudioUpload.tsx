import { useState, useRef, type ChangeEvent } from 'react';
import { useAppContext } from '../hooks/useAppContext'; // Importa tu hook de contexto
import { APPSTATE, type UploadResponse } from '../types';

export default function AudioUploader() {
  const { uploadFile, appState } = useAppContext();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Por favor, selecciona un archivo de audio primero.');
      return;
    }

    const response: UploadResponse = await uploadFile(selectedFile);
    console.log('¡Archivo subido exitosamente!');
    console.log('Respuesta del backend:', response);
  };

  const isUploading = appState === APPSTATE.UPLOADING;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-gray-800 rounded-lg shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-4">Sube un archivo de audio</h2>
      
      <input
        type="file"
        accept=".mp3, .wav, .aac" // Define los tipos de archivos aceptados
        onChange={handleFileChange}
        ref={fileInputRef}
        className="hidden"
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        className="px-6 py-3 mb-4 text-lg font-semibold text-white transition-colors duration-200 bg-indigo-600 rounded-full hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
      >
        {selectedFile ? `Archivo: ${selectedFile.name}` : 'Selecciona un archivo'}
      </button>

      <button
        onClick={handleUpload}
        disabled={isUploading || !selectedFile}
        className={`px-6 py-3 text-lg font-semibold text-white rounded-full transition-colors duration-200 ${
          isUploading
            ? 'bg-gray-500 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500'
        }`}
      >
        {isUploading ? 'Subiendo...' : 'Subir audio'}
      </button>

      {isUploading && <p className="mt-4 text-white">El archivo se está subiendo...</p>}
    </div>
  );
}