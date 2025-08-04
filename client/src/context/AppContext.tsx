import { useState, useCallback } from "react";
import type { ReactNode } from "react";
import { AppContext } from "../hooks/useAppContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { APPSTATE } from "../types";
import type { AppState, AudioFileInfo, UploadResponse } from "../types";

export default function AppProvider({ children }: { children: ReactNode }) {
  const [appState, setAppState] = useState<AppState>(APPSTATE.INIT);
  const [fileInfo, setFileInfo] = useState<AudioFileInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const {
    connect,
    isConnected,
    chunks,
    status: processingStatus,
    error: webSocketError,
    sendGetChunkSignal,
  } = useWebSocket();

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse> => {
      setAppState(APPSTATE.UPLOADING);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("http://localhost:8000/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Error al subir el archivo");
        }

        const uploadResponse: UploadResponse = await response.json();

        setFileInfo(uploadResponse.file_info);
        setSessionId(uploadResponse.session_id);
        setAppState(APPSTATE.PROCESSING);

        connect(uploadResponse.session_id)

        return uploadResponse;
      } catch (err) {
        console.error("Error en la subida:", err);
        setAppState(APPSTATE.ERROR);
        throw err;
      }
    },
    [connect]
  );

  const connectAndGetFirstChunk = useCallback(() => {
    if (isConnected) {
      sendGetChunkSignal();
    } else {
      console.error("No hay sessionId disponible para conectar el WebSocket.");
    }
  }, [sendGetChunkSignal, isConnected]);


  // El valor que se proporciona al contexto
  const contextValue = {
    appState,
    setAppState,
    fileInfo,
    setFileInfo,
    sessionId,
    uploadFile,
    chunks,
    processingStatus,
    isConnected,
    webSocketError,
    connectAndGetFirstChunk,
  };

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
}
