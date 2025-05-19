import type React from "react"
import { useEffect, useState, useRef, useCallback } from "react"
import { createRoot } from "react-dom/client"
import { Clock, Pause, StopCircle, X, Play, Zap } from "lucide-react"

// Draggable Control Panel component
const RecordingControlPanel = () => {
  console.log("Rendering RecordingControlPanel component")
  const [position, setPosition] = useState(() => {
  const x = 10 
  const y = Math.max(window.innerHeight - 70, 0) 
  console.log(`Initial position: x=${x}, y=${y}`)
  return { x, y }
})

  
  const [recordingTime, setRecordingTime] = useState<number>(0)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [showStopPopup, setShowStopPopup] = useState<boolean>(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  const recordingStartTimeRef = useRef<number>(0)
  const timerIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    console.log("Control panel mounted")
      const savedPosition = localStorage.getItem("controlPanelPosition")
    if (savedPosition) {
      try {
        const parsedPosition = JSON.parse(savedPosition)
        setPosition(parsedPosition)
      } catch (e) {
        console.error("Failed to parse saved position", e)
      }
    }

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["recording", "recordingStartTime"], (result) => {
        console.log("Retrieved recording status from storage:", result)
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

    const messageListener = (message: any) => {
      console.log("Control panel received message:", message)
      if (message.action === "startRecording") {
        handleStartRecording()
      } else if (message.action === "stopRecording") {
        handleStopRecording()
      }
    }

    if (typeof chrome !== "undefined" && chrome.runtime) {
      console.log('inside this event listener')
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
    console.log("Starting timer")
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
      console.log("Timer stopped")
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
    if (typeof chrome !== "undefined" && chrome.runtime) {
   const response=chrome.runtime.sendMessage({
    action:'startRecording',
    email:localStorage.getItem('userEmail')||'user@example.com'
   },(response)=>{
    console.log('start Recording',response)
   })

   setIsRecording(true)
    recordingStartTimeRef.current = Date.now()
    setRecordingTime(0)
    startTimer()
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
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({
        action:'stopRecording',
      })
      setIsRecording(false);
      stopTimer();
      setRecordingTime(0)
      setShowStopPopup(false)
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
      console.log("Mouse down, starting drag from:", e.clientX, e.clientY)
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
    console.log("Mouse up, ending drag")
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
        style={{
          position: "fixed",
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 99999,
          width: "300px",
          backgroundColor: "white",
          border: "2px solid black",
          borderRadius: "24px",
          padding: "8px",
          display: "flex",
          alignItems: "center",
          cursor: "move",
          boxShadow: "0 4px 8px rgba(0,0,0,0.2)"
        }}
        onMouseDown={handleMouseDown}
      >
        <button 
          onClick={handleToggleRecording}
          style={{
            backgroundColor: isRecording ? "#ef4444" : "#22c55e",
            color: "white",
            border: "none",
            borderRadius: "50%",
            padding: "8px",
            marginRight: "8px",
            cursor: "pointer",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          {isRecording ? (
            <Pause style={{ height: "20px", width: "20px" }} />
          ) : (
            <Play style={{ height: "20px", width: "20px" }} />
          )}
        </button>
        
        <div style={{
          padding: "4px 12px",
          backgroundColor: "#1e293b",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          marginRight: "8px"
        }}>
          <Clock style={{ height: "16px", width: "16px", color: "#e2e8f0", marginRight: "8px" }} />
          <span style={{ color: "white", fontSize: "14px" }}>{getCurrentTime()}</span>
        </div>
        
        <div style={{
          padding: "4px 12px",
          backgroundColor: "#1e293b",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center"
        }}>
          <span style={{ color: "white", fontSize: "14px", fontFamily: "monospace" }}>
            {isRecording ? formatTime(recordingTime) : "00:00"}
          </span>
        </div>
      </div>

      {/* Stop Recording Popup */}
      {showStopPopup && (
        <div
          style={{
            position: "fixed",
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`,
            zIndex: 99999,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(8px)",
            borderRadius: "8px",
            border: "1px solid #ef4444",
            padding: "16px",
            width: "200px",
            boxShadow: "0 0 20px rgba(239, 68, 68, 0.4)"
          }}
        >
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px"
          }}>
            <h3 style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#fca5a5",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <StopCircle style={{ height: "14px", width: "14px" }} />
              Stop Recording?
            </h3>
            <button 
              onClick={() => setShowStopPopup(false)} 
              style={{
                color: "#fca5a5",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex"
              }}
            >
              <X style={{ height: "16px", width: "16px" }} />
            </button>
          </div>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
            <button
              onClick={handleStopRecording}
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: "#dc2626",
                color: "white",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontSize: "14px",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 0 10px rgba(239, 68, 68, 0.3)"
              }}
            >
              <StopCircle style={{ height: "16px", width: "16px" }} />
              Stop Recording
            </button>
            <button
              onClick={() => setShowStopPopup(false)}
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: "transparent",
                border: "1px solid rgba(156, 163, 175, 0.5)",
                color: "#d1d5db",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer"
              }}
            >
              <Play style={{ height: "16px", width: "16px" }} />
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
  
  // Check if already exists
  if (document.getElementById("meet-recording-control-panel")) {
    console.log("Control panel already exists")
    return
  }
  
  const container = document.createElement("div")
  container.id = "meet-recording-control-panel"
  container.style.position = "fixed"
  container.style.zIndex = "99999"
  document.body.appendChild(container)
  console.log("Control panel container created:", container)

  try {
    const root = createRoot(container)
    root.render(<RecordingControlPanel />)
    console.log("Control panel rendered successfully")
  } catch (error) {
    console.error("Error rendering control panel:", error)
  }
}

// Function to remove the control panel
const removeControlPanel = () => {
  const container = document.getElementById("meet-recording-control-panel")
  if (container) {
    document.body.removeChild(container)
    console.log("Control panel removed")
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
    
    setTimeout(() => {
      console.log('Timeout complete, injecting control panel')
      injectControlPanel()
    }, 1000);
    
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("Content script received message:", message);
        
        if (message.action === "startRecording") {
          if (!document.getElementById("meet-recording-control-panel")) {
            injectControlPanel()
          }
        } else if (message.action === "stopRecording") {
          // removeControlPanel()
        } else if (message.action === "checkRecordingStatus") {
          const panel = document.getElementById("meet-recording-control-panel")
          sendResponse({ 
            controlPanelActive: !!panel
          })
        }
        
        return true
      })
    }
  },
});