// Modified content.tsx - Focus on reliable floating indicator
import type React from "react"
import { useEffect, useState, useRef, useCallback } from "react"
import { createRoot } from "react-dom/client"
import { Clock, MicOff, Play, X, Zap } from "lucide-react"

// Floating recording indicator component with improved visibility and reliability
const FloatingIndicator = () => {
  const [recordingTime, setRecordingTime] = useState<number>(0)
  const [showControls, setShowControls] = useState<boolean>(false)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const indicatorRef = useRef<HTMLDivElement>(null)
  const recordingStartTimeRef = useRef<number>(Date.now())
  const timerIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    console.log("FloatingIndicator mounted")
    
    // Start the timer
    const startTimer = () => {
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current)
      }
      
      timerIntervalRef.current = window.setInterval(() => {
        const elapsedTime = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
        setRecordingTime(elapsedTime)
      }, 1000) as unknown as number
    }

    // Load saved position on mount
    const savedPosition = localStorage.getItem("floatingIndicatorPosition")
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
          if (result.recordingStartTime) {
            recordingStartTimeRef.current = result.recordingStartTime
            const elapsedSeconds = Math.floor((Date.now() - result.recordingStartTime) / 1000)
            setRecordingTime(elapsedSeconds)
          }
        }
      })
    }

    // Start the timer
    startTimer()

    // Message listener for recording control
    const messageListener = (message: any) => {
      console.log("FloatingIndicator received message:", message)
      if (message.action === "stopRecording") {
        if (timerIntervalRef.current) {
          window.clearInterval(timerIntervalRef.current)
          timerIntervalRef.current = null
        }
        removeFloatingIndicator()
      }
    }

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener(messageListener)
    }

    return () => {
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current)
      }
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(messageListener)
      }
    }
  }, [])

  // Save position to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("floatingIndicatorPosition", JSON.stringify(position))
  }, [position])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const toggleControls = () => {
    if (!isDragging) {
      setShowControls(!showControls)
    }
  }

  const stopRecording = () => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      // Get the current tab ID and send to background script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0]
        if (currentTab?.id) {
          chrome.runtime.sendMessage({ 
            action: "stopRecording",
            tabId: currentTab.id
          })
        }
      })
    } else {
      console.log("Chrome runtime API not available, cannot send stop message")
      removeFloatingIndicator()
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (indicatorRef.current) {
      const rect = indicatorRef.current.getBoundingClientRect()
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
        const maxX = window.innerWidth - 150
        const maxY = window.innerHeight - 50

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

  // Calculate popup position to ensure it stays within viewport
  const calculatePopupPosition = () => {
    const popupPosition = {
      top: position.y + 56,
      left: position.x,
      transformOrigin: "top left",
    }
    if (position.y + 56 + 120 > window.innerHeight) {
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
    <div className="fixed w-[200px] z-[999]">
      <div
        ref={indicatorRef}
        className="fixed bg-black bg-opacity-80 text-white rounded-full py-3 px-4 shadow-lg border-2 border-purple-500 backdrop-blur-md flex items-center gap-2"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          boxShadow: "0 0 15px rgba(149, 76, 233, 0.6)",
          cursor: "move",
          zIndex: 9999
        }}
        onMouseDown={handleMouseDown}
        onClick={isDragging ? undefined : toggleControls}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
        <Clock className="h-4 w-4 text-white" />
        <span className="font-mono font-semibold text-purple-200 text-sm">{formatTime(recordingTime)}</span>
      </div>

      {/* Controls Popup */}
      {showControls && (
        <div
          className="fixed bg-black bg-opacity-80 backdrop-blur-md rounded-lg border border-purple-500 p-4 w-56 shadow-lg"
          style={{
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`,
            zIndex: 9999,
            boxShadow: "0 0 20px rgba(149, 76, 233, 0.4)"
          }}
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-purple-300 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Recording
            </h3>
            <button onClick={toggleControls} className="text-purple-300 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={stopRecording}
              className="w-full py-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors"
              style={{boxShadow: "0 0 10px rgba(239, 68, 68, 0.3)"}}
            >
              <MicOff className="h-4 w-4" />
              Stop Recording
            </button>
            <button
              onClick={toggleControls}
              className="w-full py-2 px-3 bg-transparent border border-purple-500 border-opacity-50 hover:bg-purple-800 hover:bg-opacity-30 text-purple-300 hover:text-white rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              <Play className="h-4 w-4" />
              Continue Recording
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Function to inject the floating indicator into the page
const injectFloatingIndicator = () => {
  console.log('INjector is called')
  console.log("Injecting floating indicator")
  
  if (document.getElementById("chrome-recording-indicator")) {
    console.log("Floating indicator already exists")
    return
  }
  
  const container = document.createElement("div")
  container.id = "chrome-recording-indicator"
  document.body.appendChild(container)

  const root = createRoot(container)
  root.render(<FloatingIndicator />)
  
  console.log("Floating indicator injected successfully")
}

const removeFloatingIndicator = () => {
  console.log("Removing floating indicator")
  const container = document.getElementById("chrome-recording-indicator")
  if (container) {
    document.body.removeChild(container)
  }
}

const createRecorderButton = () => {
  console.log("Creating recorder button")
  const existingButton = document.getElementById('chrome-record-button')
  if (existingButton) {
    console.log("Recorder button already exists")
    return
  }
  
  const button = document.createElement('button')
  button.id = 'chrome-record-button'
  button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><circle cx="12" cy="12" r="4"/></svg>Record Meet`
  button.className = 'fixed top-4 right-4 z-[9998] px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg shadow-lg font-semibold flex items-center justify-center gap-2 transition-colors'
  
  button.onclick = () => {
    console.log("Record button clicked")
    // Get current tab ID
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.runtime) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0]
        if (currentTab?.id) {
          chrome.runtime.sendMessage({
            action: "startRecording",
            tabId: currentTab.id,
            email: localStorage.getItem("userEmail") || "user@example.com"
          })
        }
      })
      console.log('inside the chrome checking api')
    } else {
      console.log("Chrome API not available, can't start recording")
    }
  }
  
  document.body.appendChild(button)
  console.log("Recorder button created and appended to body")
}

export default defineContentScript({
  matches: ['*://*.google.com/*', '*://meet.google.com/*'],
  main() {
    console.log('Meet recorder content script initialized');
    
    // Add a visible marker to confirm script is running
    const debugMarker = document.createElement('div');
    debugMarker.id = 'meet-recorder-debug-marker';
    debugMarker.style.position = 'fixed';
    debugMarker.style.bottom = '10px';
    debugMarker.style.right = '10px';
    debugMarker.style.backgroundColor = 'rgba(147, 51, 234, 0.5)';
    debugMarker.style.color = 'white';
    debugMarker.style.padding = '5px 10px';
    debugMarker.style.borderRadius = '4px';
    debugMarker.style.fontSize = '12px';
    debugMarker.style.zIndex = '9999';
    debugMarker.textContent = 'Meet Recorder Active';
    document.body.appendChild(debugMarker);
    
    // Create the recording button with delay to ensure DOM is ready
    setTimeout(createRecorderButton, 1000)
    
    // Check if recording is already in progress
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.session) {
      chrome.storage.session.get(["recording", "recordingStartTime"], (result) => {
        console.log("Checking recording status:", result)
        if (result?.recording) {
          console.log("Recording is active, injecting indicator")
          injectFloatingIndicator()
        }
      })
    }
    
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message) => {
        console.log("Content script received message:", message)
        if (message.action === "startRecording") {
          console.log("Starting recording from message")
          injectFloatingIndicator()
        } else if (message.action === "stopRecording") {
          console.log("Stopping recording from message")
          removeFloatingIndicator()
        }
      })
    } else {
      console.log("Chrome runtime API not available in this environment")
    }
  },
});