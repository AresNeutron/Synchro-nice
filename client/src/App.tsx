import AudioUploader from "./components/AudioUpload"
import AudioVisualizer from "./components/AudioVisualizer";
import { useAppContext } from "./hooks/useAppContext"

function App() {
  const { connectAndGetFirstChunk } = useAppContext();

  return (
    <div>
        <AudioUploader/>
        <AudioVisualizer/>
        <button onClick={()=> {connectAndGetFirstChunk()}}>ESTUS</button>
    </div>
  )
}

export default App