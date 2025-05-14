import type React from "react"
import { useEffect, useState, useRef, useCallback } from "react"
import { createRoot } from "react-dom/client"
import { Clock, MicOff, Play, X, Zap, ShieldAlert } from "lucide-react"

// Floating recording indicator component
const FloatingIndicator = () => {
  const [recordingTime, setRecordingTime] = useState<number>(0)
  const [showControls, setShowControls] = useState<boolean>(false)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [showPermissionAlert, setShowPermissionAlert] = useState(false)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const recordingStartTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsedTime = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
      setRecordingTime(elapsedTime)
    }, 1000)

    // Load saved position on mount
    const savedPosition = localStorage.getItem("floatingIndicatorPosition")
    if (savedPosition) {
      try {
        setPosition(JSON.parse(savedPosition))
      } catch (e) {
        console.error("Failed to parse saved position", e)
      }
    }

    // Check for recording status from background script
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ action: "get-recording-status" }, (response) => {
        if (response && response.isRecording) {
          recordingStartTimeRef.current = response.recordingStartTime || Date.now()
        }
      })
    }

    // Safely check if Chrome API is available
    let messageListener: ((message: any) => void) | null = null

    if (typeof chrome !== "undefined" && chrome.runtime) {
      messageListener = (message: any) => {
        if (message.action === "stopRecording") {
          clearInterval(interval)
          removeFloatingIndicator()
        } else if (message.action === "needPermissions") {
          setShowPermissionAlert(true)
        } else if (message.action === "permissionsGranted") {
          setShowPermissionAlert(false)
        }
      }

      chrome.runtime.onMessage.addListener(messageListener)
    }

    return () => {
      clearInterval(interval)
      if (typeof chrome !== "undefined" && chrome.runtime && messageListener) {
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

  const requestPermissions = () => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0]
        if (currentTab?.id) {
          chrome.runtime.sendMessage({
            action: "requestPermissions",
            tabId: currentTab.id
          })
        }
      })
    }
    setShowPermissionAlert(false)
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
      // Fallback behavior for preview
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
    // Default position is below the indicator
    const popupPosition = {
      top: position.y + 56,
      left: position.x,
      transformOrigin: "top left",
    }

    // Check if popup would go off the bottom of the screen
    if (position.y + 56 + 120 > window.innerHeight) {
      popupPosition.top = position.y - 120
      popupPosition.transformOrigin = "bottom left"
    }

    // Check if popup would go off the right of the screen
    if (position.x + 220 > window.innerWidth) {
      popupPosition.left = position.x - 220 + 100 // Adjust to keep it partially under the indicator
      popupPosition.transformOrigin = `${popupPosition.transformOrigin.split(" ")[0]} right`
    }

    return popupPosition
  }

  const popupPosition = calculatePopupPosition()

  return (
    <div className="fixed z-[9999]">
      {/* Permission Alert */}
      {showPermissionAlert && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-90 backdrop-blur-md p-4 rounded-lg border border-purple-500 shadow-lg z-[10000] w-80">
          <div className="flex items-center gap-2 mb-4 text-purple-300">
            <ShieldAlert className="h-5 w-5" />
            <h3 className="font-semibold">Permissions Required</h3>
          </div>
          <p className="text-white text-sm mb-4">
            To record your screen and audio, the extension needs additional permissions.
          </p>
          <div className="flex gap-2">
            <button 
              onClick={requestPermissions}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded text-sm font-medium flex-1"
            >
              Grant Permissions
            </button>
            <button 
              onClick={() => setShowPermissionAlert(false)}
              className="border border-purple-500/50 hover:bg-purple-800/30 text-purple-300 px-3 py-2 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Indicator */}
      <div
        ref={indicatorRef}
        className="fixed bg-black bg-opacity-80 text-white rounded-full py-2 px-4 shadow-[0_0_15px_rgba(149,76,233,0.6)] cursor-move border-2 border-purple-500 backdrop-blur-md flex items-center gap-2"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        onMouseDown={handleMouseDown}
        onClick={isDragging ? undefined : toggleControls}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
        <Clock className="h-4 w-4 text-white" />
        <span className="font-mono font-semibold text-purple-200">{formatTime(recordingTime)}</span>
      </div>

      {/* Controls Popup */}
      {showControls && (
        <div
          className="fixed bg-black bg-opacity-80 backdrop-blur-md rounded-lg border border-purple-500/50 p-4 w-56 shadow-[0_0_20px_rgba(149,76,233,0.4)] z-[9999]"
          style={{
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`,
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
              className="w-full py-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors shadow-[0_0_10px_rgba(239,68,68,0.3)]"
            >
              <MicOff className="h-4 w-4" />
              Stop Recording
            </button>
            <button
              onClick={toggleControls}
              className="w-full py-2 px-3 bg-transparent border border-purple-500/50 hover:bg-purple-800/30 text-purple-300 hover:text-white rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors"
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
  const container = document.createElement("div")
  container.id = "chrome-recording-indicator"
  document.body.appendChild(container)

  const root = createRoot(container)
  root.render(<FloatingIndicator />)
}

const removeFloatingIndicator = () => {
  const container = document.getElementById("chrome-recording-indicator")
  if (container) {
    document.body.removeChild(container)
  }
}

// Create a toggle button for the recording
const createRecorderButton = () => {
  const existingButton = document.getElementById('chrome-record-button')
  if (existingButton) return // Don't create multiple buttons
  
  const button = document.createElement('button')
  button.id = 'chrome-record-button'
  button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><circle cx="12" cy="12" r="4"/></svg>Record Meet`
  button.className = 'fixed top-4 right-4 z-[9998] px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg shadow-lg font-semibold flex items-center justify-center gap-2 transition-colors'
  
  button.onclick = () => {
    // Get current tab ID
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.runtime) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0]
        if (currentTab?.id) {
          chrome.runtime.sendMessage({
            action: "startRecording",
            tabId: currentTab.id,
            email: localStorage.getItem("userEmail") || "user@example.com"  // Default email if not set
          })
        }
      })
    } else {
      console.log("Chrome API not available, can't start recording")
    }
  }
  
  document.body.appendChild(button)
}

export default defineContentScript({
  matches: ['*://*.google.com/*', '*://meet.google.com/*'],
  main() {
    console.log('Meet recorder content script initialized');
    
    // Create the recording button
    setTimeout(createRecorderButton, 1000) // Delay to ensure DOM is ready
    
    // Check if recording is already in progress
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.session) {
      chrome.storage.session.get("recording", (result) => {
        if (result?.recording) {
          injectFloatingIndicator()
        }
      })
    }
    
    // Safely check if Chrome API is available
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "startRecording") {
          injectFloatingIndicator()
        } else if (message.action === "stopRecording") {
          removeFloatingIndicator()
        }
      })
    } else {
      console.log("Chrome runtime API not available in this environment")
    }
  },
});