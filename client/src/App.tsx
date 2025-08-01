import AudioUploader from "./components/AudioUpload"
import { useAppContext } from "./hooks/useAppContext"

function App() {
  const { connectAndGetFirstChunk } = useAppContext();

  return (
    <div>
        <AudioUploader/>
        <button onClick={()=> {connectAndGetFirstChunk()}}>ESTUS</button>
    </div>
  )
}

export default App