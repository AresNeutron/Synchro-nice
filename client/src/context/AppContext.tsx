import { useState, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { AppContext } from "../hooks/useAppContext";
import { APPSTATE } from "../types";
import type { AppState, AudioFileInfo, UploadResponse, AudioChunkData, AudioAnalysisMessage } from "../types";
import { backend_url } from "../utils/url";

export default function AppProvider({ children }: { children: ReactNode }) {
  const [appState, setAppState] = useState<AppState>(APPSTATE.INIT);
  const [fileInfo, setFileInfo] = useState<AudioFileInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Complete audio dataset storage (persists across re-renders, lost on page reload)
  const audioChunks = useRef<AudioChunkData[]>([]);
  const audioAnalysis = useRef<AudioAnalysisMessage[]>([]);
  const [loadingProgress, setLoadingProgress] = useState({
    chunks: 0,
    analysis: 0, 
    isComplete: false
  });


  const uploadFile = useCallback(
    async (file: File) => {
      setAppState(APPSTATE.UPLOADING);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch(backend_url + "/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Error uploading the file");
        }

        const uploadResponse: UploadResponse = await response.json();

        setFileInfo(uploadResponse.file_info);
        setSessionId(uploadResponse.session_id);
        
        // Start progressive loading of audio data
        if (uploadResponse.processing_complete) {
          await loadCompleteAudioData(uploadResponse.session_id, uploadResponse.total_chunks, uploadResponse.total_analysis);
        }

        // We must provide a message to the user to tell them the upload was successful
        setAppState(APPSTATE.ISREADY)
        // such a message would trigger when "appState" variable is set to ISREADY

      } catch (err) {
        console.error("Upload error:", err);
        setAppState(APPSTATE.SERVER_ERROR);
        throw err;
      }
    },
    []
  );
  
  // Progressive loading of complete audio dataset
  const loadCompleteAudioData = useCallback(async (sessionId: string, totalChunks: number, totalAnalysis: number) => {
    try {
      // Load chunks in batches
      let chunkStart = 0;
      const chunkBatchSize = 100;
      
      while (chunkStart < totalChunks) {
        const response = await fetch(
          `${backend_url}/session/${sessionId}/chunks?start=${chunkStart}&limit=${chunkBatchSize}`
        );
        
        if (!response.ok) {
          throw new Error('Error loading chunks');
        }
        
        const chunkBatch = await response.json();
        audioChunks.current.push(...chunkBatch.chunks);
        
        setLoadingProgress(prev => ({
          ...prev,
          chunks: audioChunks.current.length
        }));
        
        chunkStart += chunkBatchSize;
        
        // Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Load analysis in batches
      let analysisStart = 0;
      const analysisBatchSize = 50;
      
      while (analysisStart < totalAnalysis) {
        const response = await fetch(
          `${backend_url}/session/${sessionId}/analysis?start=${analysisStart}&limit=${analysisBatchSize}`
        );
        
        if (!response.ok) {
          throw new Error('Error loading analysis');
        }
        
        const analysisBatch = await response.json();
        audioAnalysis.current.push(...analysisBatch.analysis);
        
        setLoadingProgress(prev => ({
          ...prev,
          analysis: audioAnalysis.current.length
        }));
        
        analysisStart += analysisBatchSize;
        
        // Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Mark loading as complete
      setLoadingProgress(prev => ({ ...prev, isComplete: true }));
      console.log(`✅ Data loading complete: ${audioChunks.current.length} chunks, ${audioAnalysis.current.length} analysis`);
      
    } catch (error) {
      console.error('Error loading complete audio data:', error);
      setAppState(APPSTATE.SERVER_ERROR);
    }
  }, []);
  
  // Timestamp-based chunk retrieval for perfect synchronization
  const getChunkByTimestamp = useCallback((timestamp: number): AudioChunkData | null => {
    if (audioChunks.current.length === 0) return null;
    
    // O(1) constant time lookup using fixed 0.2s intervals
    // Chunks at: 0.0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, etc.
    const chunkIndex = Math.floor(timestamp * 5); // timestamp / 0.2
    
    // Bounds check
    if (chunkIndex < 0 || chunkIndex >= audioChunks.current.length) {
      return null;
    }
    
    return audioChunks.current[chunkIndex];
  }, []);
  
  // Timestamp-based analysis retrieval
  const getAnalysisByTimestamp = useCallback((timestamp: number): AudioAnalysisMessage | null => {
    if (audioAnalysis.current.length === 0) return null;
    
    // O(1) constant time lookup using fixed 1.0s intervals
    // Analysis at: 0.0, 1.0, 2.0, 3.0, 4.0, 5.0, etc.
    const analysisIndex = Math.floor(timestamp); // timestamp / 1.0
    
    // Bounds check
    if (analysisIndex < 0 || analysisIndex >= audioAnalysis.current.length) {
      return null;
    }
    
    return audioAnalysis.current[analysisIndex];
  }, []);

  // The value provided to the context
  const contextValue = {
    appState,
    setAppState,
    fileInfo,
    setFileInfo,
    sessionId,
    uploadFile,
    audioChunks: audioChunks.current,
    audioAnalysis: audioAnalysis.current,
    loadingProgress,
    getChunkByTimestamp,
    getAnalysisByTimestamp,
  };

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
}