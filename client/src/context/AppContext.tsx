import { useState, useCallback } from "react";
import type { ReactNode } from "react";
import { AppContext } from "../hooks/useAppContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { APPSTATE } from "../types";
import type { AppState, AudioFileInfo, UploadResponse } from "../types";

export default function AppProvider({ children }: { children: ReactNode }) {
  // we must create a component that shows the app state at any moment and gracefully
  // tells the user the changes in the state of the app
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
    async (file: File) => {
      setAppState(APPSTATE.UPLOADING);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("http://localhost:8000/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Error uploading the file");
        }

        const uploadResponse: UploadResponse = await response.json();

        setFileInfo(uploadResponse.file_info);
        setSessionId(uploadResponse.session_id);

        // We must provide a message to the user to tell them the upload was successful
        setAppState(APPSTATE.ISREADY)
        // such a message would trigger when "appState" variable is set to ISREADY

        connect(uploadResponse.session_id)

      } catch (err) {
        console.error("Upload error:", err);
        setAppState(APPSTATE.SERVER_ERROR);
        throw err;
      }
    },
    [connect]
  );

  const getInitialChunks = useCallback(() => {
    if (isConnected) {
      // Loop to request the first 10 chunks
      for (let i = 0; i < 10; i++) {
        sendGetChunkSignal();
      }
    } else {
      console.error("No active WebSocket connection.");
    }
  }, [isConnected, sendGetChunkSignal]);

  // The value provided to the context
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
    sendGetChunkSignal,
    getInitialChunks,
  };

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
}