import AudioPlayer from "./components/AudioPlayer"
import AudioUploader from "./components/AudioUpload"
import Visualizer from "./components/AudioVisualizer"
import UserMessages from "./components/UserMessages"
import { useAppContext } from "./hooks/useAppContext"
import { Music, Waves, Headphones } from 'lucide-react'
import { APPSTATE } from "./types"

function App() {
  const {appState} = useAppContext()

  return (
    <div className="min-h-screen p-4">
      {/* User Messages - Fixed position for non-intrusive feedback */}
      <UserMessages />

      {/* Header */}
      <header className="text-center mb-6">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="p-2 rounded-full glass-effect">
            <Waves className="w-6 h-6 text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">Audio Visualizer</h1>
        </div>
        <p className="text-sm text-gray-400 max-w-2xl mx-auto">
          Transform your music into stunning visual experiences. Upload an audio file and watch it come to life.
        </p>
      </header>

      {/* Main Layout - Two Column */}
      <div className="max-w-7xl mx-auto h-[calc(100vh-200px)]">
        <div className="flex gap-6 h-full">
          
          {/* Left Column - Controls */}
          <div className="w-80 flex flex-col gap-6">
            
            {/* AudioUpload - Top */}
            <div className="flex-1">
              <div className="card-soft p-4 h-full">
                <div className="flex items-center gap-2 mb-3">
                  <Music className="w-4 h-4 text-purple-400" />
                  <h2 className="text-lg font-semibold">Upload Audio</h2>
                </div>
                <AudioUploader />
              </div>
            </div>

            {/* AudioPlayer - Bottom */}
            <div className="flex-1">
              <div className="audio-controls h-full">
                <div className="flex items-center gap-2 mb-3">
                  <Headphones className="w-4 h-4 text-purple-400" />
                  <h2 className="text-lg font-semibold">Audio Controls</h2>
                </div>
                <AudioPlayer />
              </div>
            </div>

          </div>

          {/* Right Column - Visualizer (Large) */}
          <div className="flex-1">
            {appState == APPSTATE.PLAYING ? (
              <div className="visualizer-container h-full">
                <div className="flex items-center gap-2 mb-3">
                  <Waves className="w-4 h-4 text-teal-400" />
                  <h2 className="text-lg font-semibold">Visual Experience</h2>
                </div>
                <div className="h-[calc(100%-40px)]">
                  <Visualizer />
                </div>
              </div>
            ) : (
              <div className="card-soft p-12 text-center h-full flex flex-col justify-center">
                <div className="w-32 h-32 mx-auto mb-6 rounded-full glass-effect flex items-center justify-center">
                  <Headphones className="w-16 h-16 text-gray-400" />
                </div>
                <h3 className="text-2xl font-semibold mb-3 text-gray-300">Ready to Visualize</h3>
                <p className="text-gray-400 text-lg">Upload an audio file to start creating beautiful visualizations</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

export default App
