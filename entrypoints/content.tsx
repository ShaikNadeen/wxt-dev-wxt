import type React from "react"
import { useEffect, useState, useRef, useCallback } from "react"
import { createRoot } from "react-dom/client"
import { Clock, Pause, StopCircle, X, Play, Zap } from "lucide-react"

// Draggable Control Panel component
const RecordingControlPanel = () => {
  const [recordingTime, setRecordingTime] = useState<number>(0)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [showStopPopup, setShowStopPopup] = useState<boolean>(false)
  const [position, setPosition] = useState({ x: 20, y: 60 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  const recordingStartTimeRef = useRef<number>(0)
  const timerIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    console.log("Control panel mounted")
    
    // Load saved position on mount
    const savedPosition = localStorage.getItem("controlPanelPosition")
    if (savedPosition) {
      try {
        setPosition(JSON.parse(savedPosition))
      } catch (e) {
        console.error("Failed to parse saved position", e)
      }
    }

    // Check for recording status and start time from storage
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.session) {
      chrome.storage.session.get(["recording", "recordingStartTime"], (result) => {
        if (result?.recording) {
          setIsRecording(true)
          if (result.recordingStartTime) {
            recordingStartTimeRef.current = result.recordingStartTime
            const elapsedSeconds = Math.floor((Date.now() - result.recordingStartTime) / 1000)
            setRecordingTime(elapsedSeconds)
            startTimer()
          }
        }
      })
    }

    // Message listener for recording control
    const messageListener = (message: any) => {
      console.log("Control panel received message:", message)
      if (message.action === "startRecording") {
        handleStartRecording()
      } else if (message.action === "stopRecording") {
        handleStopRecording()
      }
    }

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener(messageListener)
    }

    return () => {
      stopTimer()
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(messageListener)
      }
    }
  }, [])

  // Save position to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("controlPanelPosition", JSON.stringify(position))
  }, [position])

  const startTimer = () => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current)
    }
    
    timerIntervalRef.current = window.setInterval(() => {
      const elapsedTime = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
      setRecordingTime(elapsedTime)
    }, 1000) as unknown as number
  }

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const getCurrentTime = () => {
    const now = new Date()
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const handleStartRecording = () => {
    console.log("Starting recording")
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.runtime) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0]
        if (currentTab?.id) {
          chrome.runtime.sendMessage({
            action: "startRecording",
            tabId: currentTab.id,
            email: localStorage.getItem("userEmail") || "user@example.com"
          })
          setIsRecording(true)
          recordingStartTimeRef.current = Date.now()
          setRecordingTime(0)
          startTimer()
        }
      })
    } else {
      console.log("Chrome API not available, simulating recording start")
      setIsRecording(true)
      recordingStartTimeRef.current = Date.now()
      setRecordingTime(0)
      startTimer()
    }
  }

  const handleStopRecording = () => {
    console.log("Stopping recording")
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.runtime) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0]
        if (currentTab?.id) {
          chrome.runtime.sendMessage({
            action: "stopRecording",
            tabId: currentTab.id
          })
          setIsRecording(false)
          stopTimer()
          setRecordingTime(0)
          setShowStopPopup(false)
        }
      })
    } else {
      console.log("Chrome API not available, simulating recording stop")
      setIsRecording(false)
      stopTimer()
      setRecordingTime(0)
      setShowStopPopup(false)
    }
  }

  const handleToggleRecording = () => {
    if (isRecording) {
      setShowStopPopup(true)
    } else {
      handleStartRecording()
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
      setIsDragging(true)
    }
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        // Calculate new position
        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y

        // Keep within viewport bounds
        const maxX = window.innerWidth - 300 // panel width
        const maxY = window.innerHeight - 60 // panel height

        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        })
      }
    },
    [isDragging, dragOffset],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    } else {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const calculatePopupPosition = () => {
    const popupPosition = {
      top: position.y + 60,
      left: position.x,
      transformOrigin: "top left",
    }
    
    if (position.y + 60 + 120 > window.innerHeight) {
      popupPosition.top = position.y - 120
      popupPosition.transformOrigin = "bottom left"
    }

    if (position.x + 220 > window.innerWidth) {
      popupPosition.left = position.x - 220 + 100 
      popupPosition.transformOrigin = `${popupPosition.transformOrigin.split(" ")[0]} right`
    }

    return popupPosition
  }

  const popupPosition = calculatePopupPosition()

  return (
    <>
      <div 
        ref={panelRef}
        className="relative rounded-full bg-red-600 bg-opacity-80 backdrop-blur-md border   border-gray-700 flex items-center p-2 cursor-move shadow-lg"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 9999,
          minWidth: '300px',
          background:'#fff',
          position:'relative',
          
        }}
        onMouseDown={handleMouseDown}
      >
        <button 
          onClick={handleToggleRecording}
          className="rounded-full p-2 mr-2 text-white hover:bg-gray-700 transition-colors"
        >
          {isRecording ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </button>
        
        <div className="px-3 py-1 bg-gray-800 rounded-md flex items-center mr-2">
          <Clock className="h-4 w-4 text-gray-300 mr-2" />
          <span className="text-white text-sm">{getCurrentTime()}</span>
        </div>
        
        <div className="px-3 py-1 bg-gray-800 rounded-md flex items-center">
          <span className="text-white text-sm font-mono">
            {isRecording ? formatTime(recordingTime) : "00:00"}
          </span>
        </div>
      </div>

      {/* Stop Recording Popup */}
      {showStopPopup && (
        <div
          className="fixed bg-black bg-opacity-80 backdrop-blur-md rounded-lg border border-red-500 p-4 w-56 shadow-lg"
          style={{
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`,
            zIndex: 9999,
            boxShadow: "0 0 20px rgba(239, 68, 68, 0.4)"
          }}
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-red-300 flex items-center gap-1.5">
              <StopCircle className="h-3.5 w-3.5" />
              Stop Recording?
            </h3>
            <button onClick={() => setShowStopPopup(false)} className="text-red-300 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleStopRecording}
              className="w-full py-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors"
              style={{boxShadow: "0 0 10px rgba(239, 68, 68, 0.3)"}}
            >
              <StopCircle className="h-4 w-4" />
              Stop Recording
            </button>
            <button
              onClick={() => setShowStopPopup(false)}
              className="w-full py-2 px-3 bg-transparent border border-gray-500 border-opacity-50 hover:bg-gray-800 hover:bg-opacity-30 text-gray-300 hover:text-white rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              <Play className="h-4 w-4" />
              Continue Recording
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// Function to inject the control panel into the page
const injectControlPanel = () => {
  console.log('Injecting control panel')
  
  if (document.getElementById("meet-recording-control-panel")) {
    console.log("Control panel already exists")
    return
  }
  
  const container = document.createElement("div")
  container.id = "meet-recording-control-panel"
  document.body.appendChild(container)

  try {
    const root = createRoot(container)
    root.render(<RecordingControlPanel />)
    console.log("Control panel injected successfully")
  } catch (error) {
    console.error("Error rendering control panel:", error)
  }
}

export default defineContentScript({
  matches: ['*://*.google.com/*', '*://meet.google.com/*'],
  main() {
    console.log('Meet recorder content script initialized');
    
    // Check if we're on a Google Meet page
    const isGoogleMeet = window.location.hostname === 'meet.google.com' || 
                        (window.location.hostname.includes('google.com') && 
                         window.location.pathname.includes('/meet/'));
    
    if (!isGoogleMeet) {
      console.log('Not a Google Meet page, exiting');
      return;
    }
    
    // Inject control panel with delay to ensure DOM is ready
    setTimeout(injectControlPanel, 1000);
    
    // Listen for messages from background script or popup
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("Content script received message:", message);
        
        // Handle any additional message processing if needed
        if (message.action === "checkRecordingStatus") {
          const panel = document.getElementById("meet-recording-control-panel");
          sendResponse({ 
            controlPanelActive: !!panel
          });
        }
        
        return true;
      });
    }
  },
});