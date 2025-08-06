import { useAppContext } from '../hooks/useAppContext'
import { APPSTATE } from '../types'
import { CheckCircle, AlertCircle, Play, Pause, Loader2, XCircle } from 'lucide-react'

// This component gracefully handles feedback to the user
function UserMessages() {
  const { appState } = useAppContext()

  // Don't show anything for INIT state (clean initial experience)
  if (appState === APPSTATE.INIT) {
    return null
  }

  const getMessageConfig = () => {
    switch (appState) {
      case APPSTATE.UPLOADING:
        return {
          icon: <Loader2 className="w-5 h-5 animate-spin text-blue-400" />,
          title: "Processing Audio",
          message: "We're analyzing your audio file and preparing the visualization data...",
          bgColor: "bg-blue-500/10",
          borderColor: "border-blue-500/30",
          textColor: "text-blue-300"
        }

      case APPSTATE.SERVER_ERROR:
        return {
          icon: <XCircle className="w-5 h-5 text-red-400" />,
          title: "Upload Failed",
          message: "There was an issue processing your audio file. Please try again with a different file.",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/30",
          textColor: "text-red-300"
        }

      case APPSTATE.ISREADY:
        return {
          icon: <CheckCircle className="w-5 h-5 text-green-400" />,
          title: "Ready to Visualize!",
          message: "Your audio has been processed successfully. Press play to start the visual experience.",
          bgColor: "bg-green-500/10",
          borderColor: "border-green-500/30",
          textColor: "text-green-300"
        }

      case APPSTATE.PLAYING:
        return {
          icon: <Play className="w-5 h-5 text-purple-400" />,
          title: "Visualizing",
          message: "Enjoy the visual symphony! Your music is being transformed into beautiful patterns.",
          bgColor: "bg-purple-500/10",
          borderColor: "border-purple-500/30",
          textColor: "text-purple-300"
        }

      case APPSTATE.PAUSED:
        return {
          icon: <Pause className="w-5 h-5 text-yellow-400" />,
          title: "Paused",
          message: "Visualization paused. Press play to continue the visual experience.",
          bgColor: "bg-yellow-500/10",
          borderColor: "border-yellow-500/30",
          textColor: "text-yellow-300"
        }

      case APPSTATE.VIDEO_ERROR:
        return {
          icon: <AlertCircle className="w-5 h-5 text-orange-400" />,
          title: "Visualization Error",
          message: "There was an issue with the visual generation. Try refreshing or uploading a new file.",
          bgColor: "bg-orange-500/10",
          borderColor: "border-orange-500/30",
          textColor: "text-orange-300"
        }

      default:
        return null
    }
  }

  const config = getMessageConfig()
  
  if (!config) return null

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div 
        className={`
          ${config.bgColor} ${config.borderColor} ${config.textColor}
          backdrop-blur-md border rounded-xl p-4 shadow-lg
          animate-in slide-in-from-right-5 duration-300
          smooth-transition
        `}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {config.icon}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm mb-1">
              {config.title}
            </h4>
            <p className="text-xs opacity-90 leading-relaxed">
              {config.message}
            </p>
          </div>
        </div>

        {/* Progress indicator for uploading state */}
        {appState === APPSTATE.UPLOADING && (
          <div className="mt-3">
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div 
                className="bg-blue-400 h-1.5 rounded-full animate-pulse"
                style={{ width: '60%' }}
              ></div>
            </div>
          </div>
        )}

        {/* Subtle pulse animation for active states */}
        {(appState === APPSTATE.PLAYING || appState === APPSTATE.UPLOADING) && (
          <div className="absolute inset-0 rounded-xl border border-current opacity-20 animate-pulse"></div>
        )}
      </div>
    </div>
  )
}

export default UserMessages
