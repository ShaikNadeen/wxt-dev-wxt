import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Clock } from "lucide-react"

const DraggableIndicator = ({
  recordingTime,
  formatTime,
  toggleControls,
}: {
  recordingTime: number
  formatTime: (seconds: number) => string
  toggleControls: () => void
}) => {
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const indicatorRef = useRef<HTMLDivElement>(null)


  useEffect(() => {
    localStorage.setItem("floatingIndicatorPosition", JSON.stringify(position))
    window.dispatchEvent(
      new CustomEvent("floatingIndicatorMove", {
        detail: { position },
      }),
    )
  }, [position])

  // Add this useEffect to load saved position
  useEffect(() => {
    const savedPosition = localStorage.getItem("floatingIndicatorPosition")
    if (savedPosition) {
      try {
        setPosition(JSON.parse(savedPosition))
      } catch (e) {
        console.error("Failed to parse saved position", e)
      }
    }
  }, [])

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

  const indicatorStyles = {
    position: "fixed" as const,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    color: "white",
    borderRadius: "9999px",
    padding: "16px",
    boxShadow: "0 0 15px rgba(149, 76, 233, 0.6)",
    cursor: "move",
    border: "2px solid #a855f7",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    zIndex: 9999,
    left: `${position.x}px`,
    top: `${position.y}px`,
  }

  const dotStyles = {
    width: "10px",
    height: "10px",
    borderRadius: "9999px",
    backgroundColor: "#f50c27",
    animation: "pulse 2s infinite",
  }

  const clockStyles = {
    height: "16px",
    width: "16px",
    color: "#fff",
  }

  const timeStyles = {
    fontFamily: "monospace",
    fontWeight: 600,
    fontSize:'14px',
    color: "#e9d5ff",
  }

  return (
    <div
      ref={indicatorRef}
      style={indicatorStyles}
      onMouseDown={handleMouseDown}
      onClick={isDragging ? undefined : toggleControls}
    >
      <div style={dotStyles}></div>
      <Clock style={clockStyles} />
      <span style={timeStyles}>{formatTime(recordingTime)}</span>
    </div>
  )
}

export default DraggableIndicator
