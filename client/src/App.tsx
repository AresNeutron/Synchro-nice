import AudioPlayer from "./components/AudioPlayer";
import AudioUploader from "./components/AudioUpload"
import AudioVisualizer from "./components/AudioVisualizer";
import { useAppContext } from "./hooks/useAppContext"

function App() {
  const { isConnected } = useAppContext();

  return (
    <div>
        <AudioUploader/>
        {isConnected && <AudioVisualizer/>}
        <AudioPlayer/>
    </div>
  )
}

export default App