// entrypoints/popup/components/RecordDialogComponent.tsx - simplified version

import { useState, useEffect } from "react"
import { ChevronRight, Mail } from "lucide-react"
import { Button, Input } from "@mui/material"

export default function RecordingExtension() {
  const [email, setEmail] = useState<string>("")
  const [isEmailSet, setIsEmailSet] = useState<boolean>(false)
  const [recordingStatus, setRecordingStatus] = useState<{isRecording: boolean, recordingStartTime: number} | null>(null)

  useEffect(() => {
    const savedEmail = localStorage.getItem("userEmail")
    if (savedEmail) {
      setEmail(savedEmail)
      setIsEmailSet(true)
    }

    // Check current recording status
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ action: "get-recording-status" }, (response) => {
        if (response) {
          setRecordingStatus(response)
        }
      })
    }
  }, [])

  const saveEmail = () => {
    if (email && email.includes("@")) {
      localStorage.setItem("userEmail", email)
      setIsEmailSet(true)
      
      // Notify content script that email is set
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { 
              action: "emailSet", 
              email: email 
            })
          }
        })
      }
    }
  }

  const changeEmail = () => {
    setIsEmailSet(false)
  }

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
    backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJncmlkIiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxwYXRoIGQ9Ik0gMjAgMCBMIDAgMCAwIDIwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMTQ5LCA3NiwgMjMzLCAwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')",
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

  const statusMessageStyles = {
    textAlign: "center" as const,
    padding: "16px",
    color: "#d8b4fe",
    fontSize: "14px",
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
              <div style={headerTitleStyles}>
                <Mail style={iconStyles} />
                <h2 style={titleTextStyles}>Meet Recorder Setup</h2>
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
                
                <div style={statusMessageStyles}>
                  {recordingStatus?.isRecording ? 
                    "Recording is active. Use the floating controls on the Meet page to manage recording." : 
                    "Email saved! You can now access the recording controls on Google Meet."
                  }
                </div>
                
                <p style={{
                  fontSize: "12px",
                  color: "#d8b4fe",
                  textAlign: "center" as const
                }}>
                  You can close this popup. Recording controls will appear directly on the Meet page.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}