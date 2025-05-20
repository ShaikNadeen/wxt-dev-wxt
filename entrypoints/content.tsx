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
      const response = chrome.runtime.sendMessage({
        action: 'startRecording',
        email: localStorage.getItem('userEmail') || 'user@example.com'
      }, (response) => {
        console.log('start Recording', response)
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
        action: 'stopRecording',
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
          cursor: "move",
          background: "linear-gradient(to right, #f97316, #f59e0b, #ec4899)",
          borderRadius: "0.75rem",
          padding: "0.5rem",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
        }}
        onMouseDown={handleMouseDown}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button 
            onClick={handleToggleRecording}
            style={{
              position: "relative",
              width: "2.25rem",
              height: "2.25rem",
              borderRadius: "0.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              transition: "background-color 0.2s",
              background: isRecording
                ? "linear-gradient(to bottom right, #dc2626, #991b1b)"
                : "linear-gradient(to bottom right, #ffffff, #f3f4f6)",
              border: "none",
              cursor: "pointer"
            }}
          >
            {isRecording ? (
              <Pause style={{ height: "1rem", width: "1rem", color: "white" }} />
            ) : (
              <Play style={{ 
                height: "1rem", 
                width: "1rem", 
                color: "#f97316",
                marginLeft: "0.125rem"
              }} />
            )}
          </button>
          
          <div style={{
            padding: "0.375rem 0.75rem",
            background: "linear-gradient(to right, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1))",
            borderRadius: "0.5rem",
            display: "flex",
            alignItems: "center"
          }}>
            <Clock style={{ height: "0.875rem", width: "0.875rem", color: "white", marginRight: "0.5rem" }} />
            <span style={{ color: "white", fontSize: "0.75rem", fontWeight: 500 }}>{getCurrentTime()}</span>
          </div>
          
          <div style={{
            padding: "0.375rem 0.75rem",
            borderRadius: "0.5rem",
            display: "flex",
            alignItems: "center",
            background: isRecording
              ? "linear-gradient(to right, rgba(220, 38, 38, 0.3), rgba(220, 38, 38, 0.3))"
              : "linear-gradient(to right, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1))",
            border: isRecording ? "1px solid rgba(248, 113, 113, 0.3)" : "none"
          }}>
            <span style={{ 
              fontSize: "0.75rem", 
              fontFamily: "monospace", 
              fontWeight: 600,
              letterSpacing: "0.05em",
              color: "white" 
            }}>
              {formatTime(recordingTime)}
            </span>
            {isRecording && (
              <div style={{ 
                marginLeft: "0.5rem", 
                display: "flex", 
                alignItems: "center", 
                gap: "0.125rem" 
              }}>
                <div style={{ 
                  width: "0.25rem", 
                  height: "0.75rem", 
                  backgroundColor: "white", 
                  borderRadius: "0.125rem",
                  animation: "pulse 1s infinite" 
                }}></div>
                <div style={{ 
                  width: "0.25rem", 
                  height: "0.5rem", 
                  backgroundColor: "white", 
                  borderRadius: "0.125rem",
                  animation: "pulse 1s infinite",
                  animationDelay: "75ms"
                }}></div>
                <div style={{ 
                  width: "0.25rem", 
                  height: "1rem", 
                  backgroundColor: "white", 
                  borderRadius: "0.125rem",
                  animation: "pulse 1s infinite",
                  animationDelay: "150ms"
                }}></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stop Recording Popup */}
      {showStopPopup && (
        <div
          style={{
            position: "fixed",
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`,
            zIndex: 10000,
            width: "16rem",
            background: "linear-gradient(to bottom right, #ea580c, #f59e0b, #db2777)",
            borderRadius: "0.75rem",
            padding: "1rem",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
          }}
        >
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.75rem"
          }}>
            <h3 style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "white",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem"
            }}>
              <StopCircle style={{ height: "0.875rem", width: "0.875rem" }} />
              Stop Recording?
            </h3>
            <button 
              onClick={() => setShowStopPopup(false)} 
              style={{
                color: "rgba(255, 255, 255, 0.7)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                transition: "color 0.2s"
              }}
              onMouseOver={(e) => e.currentTarget.style.color = "white"}
              onMouseOut={(e) => e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)"}
            >
              <X style={{ height: "1rem", width: "1rem" }} />
            </button>
          </div>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem"
          }}>
            <button
              onClick={handleStopRecording}
              style={{
                width: "100%",
                padding: "0.5rem",
                background: "linear-gradient(to right, #dc2626, #b91c1c)",
                color: "white",
                borderRadius: "0.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                transition: "background 0.2s"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "linear-gradient(to right, #b91c1c, #991b1b)"
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "linear-gradient(to right, #dc2626, #b91c1c)"
              }}
            >
              <StopCircle style={{ height: "1rem", width: "1rem" }} />
              Stop Recording
            </button>
            <button
              onClick={() => setShowStopPopup(false)}
              style={{
                width: "100%",
                padding: "0.5rem",
                background: "linear-gradient(to right, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.2))",
                color: "white",
                borderRadius: "0.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                transition: "background 0.2s"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "linear-gradient(to right, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.3))"
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "linear-gradient(to right, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.2))"
              }}
            >
              <Play style={{ height: "1rem", width: "1rem" }} />
              Continue Recording
            </button>
          </div>
        </div>
      )}

      {/* Add CSS for animations */}
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}
      </style>
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

    const isGoogleMeet = window.location.hostname === 'meet.google.com' && window.location.pathname !== '/landing';
    
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
          removeControlPanel()
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