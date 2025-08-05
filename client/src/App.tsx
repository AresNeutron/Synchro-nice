import AudioPlayer from "./components/AudioPlayer"
import AudioUploader from "./components/AudioUpload"
import Visualizer from "./components/AudioVisualizer"
import { useAppContext } from "./hooks/useAppContext"
import { Music, Waves, Headphones } from "lucide-react"

function App() {
  const { isConnected } = useAppContext()

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <header className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 rounded-full glass-effect">
            <Waves className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-4xl font-bold gradient-text">Audio Visualizer</h1>
        </div>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          Transform your music into stunning visual experiences. Upload an audio file and watch it come to life.
        </p>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <div className="lg:col-span-1">
            <div className="card-soft p-6">
              <div className="flex items-center gap-2 mb-4">
                <Music className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl font-semibold">Upload Audio</h2>
              </div>
              <AudioUploader />
            </div>
          </div>

          {/* Visualizer Section */}
          <div className="lg:col-span-2">
            {isConnected ? (
              <div className="visualizer-container">
                <div className="flex items-center gap-2 mb-4">
                  <Waves className="w-5 h-5 text-teal-400" />
                  <h2 className="text-xl font-semibold">Visual Experience</h2>
                </div>
                <Visualizer />
              </div>
            ) : (
              <div className="card-soft p-12 text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full glass-effect flex items-center justify-center">
                  <Headphones className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-300">Ready to Visualize</h3>
                <p className="text-gray-400">Upload an audio file to start creating beautiful visualizations</p>
              </div>
            )}
          </div>
        </div>

        {/* Audio Player Section */}
        <div className="mt-6">
          <div className="audio-controls">
            <div className="flex items-center gap-2 mb-4">
              <Headphones className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-semibold">Audio Controls</h2>
            </div>
            <AudioPlayer />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
