"use client"

import { useState, useEffect } from "react"
import { ChevronRight, Mail, Mic, MicOff, Play, Settings, X, Zap } from "lucide-react"
import DraggableIndicator from "./DraggableIndicatorComponent"
import { Button, Input } from "@mui/material"
import { calculatePopupPosition } from "../utils/calculate-popup-postion.utils"

export default function RecordingExtension() {
  const [email, setEmail] = useState<string>("")
  const [isEmailSet, setIsEmailSet] = useState<boolean>(false)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [recordingTime, setRecordingTime] = useState<number>(0)
  const [showFloatingControls, setShowFloatingControls] = useState<boolean>(false)
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null)
  const [indicatorPosition, setIndicatorPosition] = useState({ x: 20, y: 20 })

  // Add this useEffect to listen for position changes
  useEffect(() => {
    const handlePositionChange = (e: CustomEvent) => {
      setIndicatorPosition(e.detail.position)
    }

    window.addEventListener("floatingIndicatorMove", handlePositionChange as EventListener)

    // Load saved position on mount
    const savedPosition = localStorage.getItem("floatingIndicatorPosition")
    if (savedPosition) {
      try {
        setIndicatorPosition(JSON.parse(savedPosition))
      } catch (e) {
        console.error("Failed to parse saved position", e)
      }
    }

    return () => {
      window.removeEventListener("floatingIndicatorMove", handlePositionChange as EventListener)
    }
  }, [])

  useEffect(() => {
    const savedEmail = localStorage.getItem("userEmail")
    if (savedEmail) {
      setEmail(savedEmail)
      setIsEmailSet(true)
    }

    // Check if recording is in progress
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.session) {
      chrome.storage.session.get("recording", (result) => {
        if (result?.recording) {
          setIsRecording(true)
          startTimer()
        }
      })
    } else {
      console.log("Chrome storage API not available in this environment")
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  const saveEmail = () => {
    if (email && email.includes("@")) {
      localStorage.setItem("userEmail", email)
      setIsEmailSet(true)
    }
  }

  const changeEmail = () => {
    setIsEmailSet(false)
  }

  const startTimer = () => {
    const id = setInterval(() => {
      setRecordingTime((prev) => prev + 1)
    }, 1000)
    setIntervalId(id)
  }

  const stopTimer = () => {
    if (intervalId) {
      clearInterval(intervalId)
      setIntervalId(null)
    }
  }

  const handleRecordClick = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const startRecording = () => {
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.runtime) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0]
        if (currentTab?.id) {
          chrome.runtime.sendMessage({
            action: "startRecording",
            tabId: currentTab.id,
            email: email,
          })
          setIsRecording(true)
          startTimer()
        }
      })
    } else {
      // Fallback for preview environment
      console.log("Chrome API not available, simulating recording start")
      setIsRecording(true)
      startTimer()
    }
  }

  const stopRecording = () => {
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.runtime) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0]
        if (currentTab?.id) {
          chrome.runtime.sendMessage({
            action: "stopRecording",
            tabId: currentTab.id,
          })
          setIsRecording(false)
          stopTimer()
          setRecordingTime(0)
        }
      })
    } else {
      // Fallback for preview environment
      console.log("Chrome API not available, simulating recording stop")
      setIsRecording(false)
      stopTimer()
      setRecordingTime(0)
    }
  }

  const toggleFloatingControls = () => {
    setShowFloatingControls(!showFloatingControls)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const popupPosition = calculatePopupPosition(indicatorPosition)

  const containerStyles = {
    width: "400px",
    background: "linear-gradient(to bottom right, #6b21a8, #581c87, #3730a3)",
    color: "white",
    height:'300px',
    display:'flex',
    alignItems:"center",
    justifyContent:"center",
  }

  const patternOverlayStyles = {
    position: "absolute" as const,
    inset: 0,
    backgroundImage:
      "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJncmlkIiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxwYXRoIGQ9Ik0gMjAgMCBMIDAgMCAwIDIwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMTQ5LCA3NiwgMjMzLCAwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')",
  }

  const cardStyles = {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    backdropFilter: "blur(8px)",
    borderRadius: "12px",
    overflow: "hidden",
    border: "1px solid rgba(149, 76, 233, 0.5)",
    boxShadow: "0 0 20px rgba(149, 76, 233, 0.3)",
    width:'380px',
    height:'290px'
  }

  const cardHeaderStyles = {
    padding: "20px",
    borderBottom: "1px solid rgba(149, 76, 233, 0.3)",
  }

  const headerTitleStyles = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  }

  const titleTextStyles = {
    fontSize: "18px",
    fontWeight: "bold",
    color: "white",
  }

  const iconStyles = {
    height: "20px",
    width: "20px",
    color: "#d8b4fe",
  }

  const cardBodyStyles = {
    padding: "20px",
  }

  const flexColStyles = {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
  }

  const emailRowStyles = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  }

  const emailTextStyles = {
    fontSize: "14px",
    color: "#d8b4fe",
  }

  const changeButtonStyles = {
    fontSize: "12px",
    color: "#d8b4fe",
    background: "none",
    border: "none",
    cursor: "pointer",
  }

  const recordButtonStyles = (isRecording: boolean) => ({
    width: "100%",
    padding: "12px 16px",
    borderRadius: "8px",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "all 300ms",
    backgroundColor: isRecording ? "#dc2626" : "#9333ea",
    color: "white",
    border: "none",
    cursor: "pointer",
    boxShadow: `0 0 15px rgba(${isRecording ? "239, 68, 68" : "149, 76, 233"}, 0.5)`,
  })

  const recordingTimeStyles = {
    textAlign: "center" as const,
    fontSize: "14px",
    color: "#d8b4fe",
  }

  const floatingControlsStyles = {
    position: "fixed" as const,
    zIndex: 50,
  }

  const popupStyles = {
    position: "fixed" as const,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    backdropFilter: "blur(8px)",
    borderRadius: "8px",
    border: "1px solid rgba(149, 76, 233, 0.5)",
    padding: "16px",
    width: "224px",
    boxShadow: "0 0 20px rgba(149, 76, 233, 0.4)",
    zIndex: 9999,
    top: `${popupPosition.top}px`,
    left: `${popupPosition.left}px`,
    transformOrigin: popupPosition.transformOrigin,
  }

  const popupHeaderStyles = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  }

  const popupTitleStyles = {
    fontSize: "14px",
    fontWeight: 600,
    color: "#d8b4fe",
  }

  const closeButtonStyles = {
    color: "#d8b4fe",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
  }

  const buttonContainerStyles = {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  }

  const stopButtonStyles = {
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
    transition: "background-color 150ms",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 0 10px rgba(239, 68, 68, 0.3)",
  }

  const continueButtonStyles = {
    width: "100%",
    padding: "8px 12px",
    backgroundColor: "transparent",
    border: "1px solid rgba(149, 76, 233, 0.5)",
    color: "#d8b4fe",
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontSize: "14px",
    fontWeight: 500,
    transition: "all 150ms",
    cursor: "pointer",
  }

  return (
    <div style={containerStyles}>
      <div style={patternOverlayStyles}></div>
      <div>
        {!isEmailSet ? (
          <div style={cardStyles} >
            <div style={cardHeaderStyles}>
              <div style={headerTitleStyles}>
                <Mail style={iconStyles} />
                <h2 style={titleTextStyles}>Enter Your Email</h2>
              </div>
            </div>
            <div style={cardBodyStyles}>
              <div style={flexColStyles}>
                <div>
                  <Input
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 16px",
                      backgroundColor: "rgba(147, 51, 234, 0.5)",
                      border: "1px solid rgba(149, 76, 233, 0.5)",
                      borderRadius: "8px",
                      color: "white",
                    }}
                  />
                </div>
                <Button
                  onClick={saveEmail}
                  disabled={!email || !email.includes("@")}
                  style={{
                    width: "100%",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    transition: "all 300ms",
                    backgroundColor: !email || !email.includes("@") ? "rgba(147, 51, 234, 0.5)" : "#9333ea",
                    color: !email || !email.includes("@") ? "#d8b4fe" : "white",
                    cursor: !email || !email.includes("@") ? "not-allowed" : "pointer",
                    boxShadow: !email || !email.includes("@") ? "none" : "0 0 10px rgba(149, 76, 233, 0.5)",
                  }}
                >
                  Continue
                  <ChevronRight style={{ height: "16px", width: "16px" }} />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div style={cardStyles}>
            <div style={cardHeaderStyles}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={titleTextStyles}>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Zap style={iconStyles} />
                    Screen Recorder
                  </span>
                </h2>
                <Settings style={iconStyles} />
              </div>
            </div>
            <div style={cardBodyStyles}>
              <div style={flexColStyles}>
                <div style={emailRowStyles}>
                  <span style={emailTextStyles}>{email}</span>
                  <button onClick={changeEmail} style={changeButtonStyles}>
                    Change
                  </button>
                </div>

                <button onClick={handleRecordClick} style={recordButtonStyles(isRecording)}>
                  {isRecording ? (
                    <>
                      <MicOff style={{ height: "20px", width: "20px" }} />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic style={{ height: "20px", width: "20px" }} />
                      Start Recording
                    </>
                  )}
                </button>

                {isRecording && <div style={recordingTimeStyles}>Recording time: {formatTime(recordingTime)}</div>}
              </div>
            </div>
          </div>
        )}

        {isRecording && (
          <div style={floatingControlsStyles}>
            <DraggableIndicator
              recordingTime={recordingTime}
              formatTime={formatTime}
              toggleControls={toggleFloatingControls}
            />

            {showFloatingControls && (
              <div style={popupStyles}>
                <div style={popupHeaderStyles}>
                  <h3 style={popupTitleStyles}>Recording</h3>
                  <button onClick={toggleFloatingControls} style={closeButtonStyles}>
                    <X style={{ height: "16px", width: "16px" }} />
                  </button>
                </div>
                <div style={buttonContainerStyles}>
                  <button onClick={stopRecording} style={stopButtonStyles}>
                    <MicOff style={{ height: "16px", width: "16px" }} />
                    Stop Recording
                  </button>
                  <button onClick={toggleFloatingControls} style={continueButtonStyles}>
                    <Play style={{ height: "16px", width: "16px" }} />
                    Continue Recording
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
