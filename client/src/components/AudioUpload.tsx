// THE LOGIC IN THIS COMPONENT IS COMPLETED, DO NOT TOUCH ANYTHING

import type React from "react"
import { useState, useRef, type ChangeEvent } from "react"
import { useAppContext } from "../hooks/useAppContext"
import { APPSTATE } from "../types"
import { Music, Upload, Loader2, CheckCircle } from "lucide-react"

export default function AudioUploader() {
  const { uploadFile, appState } = useAppContext()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0])
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0])
    }
  }

  const handleUpload = async () => {
    if (selectedFile) {
      await uploadFile(selectedFile)
    }
  }

  const isUploading = appState === APPSTATE.UPLOADING
  const isReady = appState === APPSTATE.ISREADY

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".mp3, .wav, .aac, .m4a, .flac"
        onChange={handleFileChange}
        ref={fileInputRef}
        className="hidden"
      />

      {/* Drag & Drop Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer smooth-transition
          ${
            dragActive
              ? "border-purple-400 bg-purple-400/10"
              : "border-gray-600 hover:border-purple-400/50 hover:bg-purple-400/5"
          }
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center space-y-4">
          <div
            className={`
            p-4 rounded-full smooth-transition
            ${dragActive ? "bg-purple-400/20" : "bg-gray-700/50"}
          `}
          >
            <Upload
              className={`
              w-8 h-8 smooth-transition
              ${dragActive ? "text-purple-400" : "text-gray-400"}
            `}
            />
          </div>

          <div>
            <p className="text-lg font-medium text-gray-200 mb-1">
              {dragActive ? "Drop your audio file here" : "Choose an audio file"}
            </p>
            <p className="text-sm text-gray-400">or drag and drop • MP3, WAV, AAC, M4A, FLAC</p>
          </div>
        </div>
      </div>

      {/* Selected File Info */}
      {selectedFile && (
        <div className="glass-effect rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-purple-400/20">
              <Music className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">{selectedFile.name}</p>
              <p className="text-xs text-gray-400">{formatFileSize(selectedFile.size)}</p>
            </div>
            {isReady && <CheckCircle className="w-5 h-5 text-green-400" />}
          </div>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={isUploading || !selectedFile}
        className={`
          w-full btn-primary flex items-center justify-center space-x-2 py-3
          ${isUploading || !selectedFile ? "opacity-50 cursor-not-allowed" : "hover:glow-effect"}
        `}
      >
        {isUploading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Uploading...</span>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5" />
            <span>Upload & Process</span>
          </>
        )}
      </button>

      {/* Status Messages */}
      {isUploading && (
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 text-sm text-purple-400">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
            <span>Processing your audio file...</span>
          </div>
        </div>
      )}

      {isReady && (
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 text-sm text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>Ready for visualization!</span>
          </div>
        </div>
      )}
    </div>
  )
}