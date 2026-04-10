import { useEffect, useState, useCallback, useRef } from "react"
import { useFarmStore } from "../../stores/farm"
import { usePhoneGridStore } from "../../stores/phoneGrid"
import { useT } from "../../i18n"
import styles from "./PhoneGridPage.module.css"

export function PhoneGridPage() {
  const t = useT()
  const phones = useFarmStore((s) => s.phones)
  const fetchPhones = useFarmStore((s) => s.fetchPhones)

  const {
    screens,
    focusedSerial,
    orchestratorUrl,
    setOrchestratorUrl,
    connectGrid,
    disconnectGrid,
    focusDevice,
    unfocusDevice,
    sendInput,
    sendLLMCommand,
  } = usePhoneGridStore()

  const [chatInput, setChatInput] = useState("")
  const [chatResponse, setChatResponse] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const focusRef = useRef<HTMLImageElement>(null)

  // Init: detect orchestrator URL from environment or current page
  useEffect(() => {
    if (!orchestratorUrl) {
      // Try to get from API
      fetch("/api/services/stats")
        .then((r) => r.json())
        .then((data) => {
          if (data.last_event) {
            // Stats came from orchestrator — use relative URL (proxied)
            // Or use ORCHESTRATOR_URL env if available
            const url =
              (window as any).__ORCHESTRATOR_URL ||
              localStorage.getItem("orchestratorUrl") ||
              ""
            if (url) setOrchestratorUrl(url)
          }
        })
        .catch(() => {})
    }
  }, [orchestratorUrl, setOrchestratorUrl])

  // Connect grid WebSocket when orchestrator URL is set
  useEffect(() => {
    if (orchestratorUrl) {
      connectGrid()
      return () => disconnectGrid()
    }
  }, [orchestratorUrl, connectGrid, disconnectGrid])

  // Fetch phones periodically
  useEffect(() => {
    fetchPhones()
    const id = setInterval(fetchPhones, 15_000)
    return () => clearInterval(id)
  }, [fetchPhones])

  // Handle click on phone screen (in focus mode) → send tap
  const handleScreenClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!focusedSerial || !focusRef.current) return

      const rect = focusRef.current.getBoundingClientRect()
      const x = Math.round(((e.clientX - rect.left) / rect.width) * 720)
      const y = Math.round(((e.clientY - rect.top) / rect.height) * 1600)

      sendInput(focusedSerial, { type: "tap", x, y })
    },
    [focusedSerial, sendInput]
  )

  // Handle swipe (mousedown → mousemove → mouseup)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!focusRef.current) return
    const rect = focusRef.current.getBoundingClientRect()
    swipeStart.current = {
      x: Math.round(((e.clientX - rect.left) / rect.width) * 720),
      y: Math.round(((e.clientY - rect.top) / rect.height) * 1600),
    }
  }, [])

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!focusedSerial || !focusRef.current || !swipeStart.current) return

      const rect = focusRef.current.getBoundingClientRect()
      const x2 = Math.round(((e.clientX - rect.left) / rect.width) * 720)
      const y2 = Math.round(((e.clientY - rect.top) / rect.height) * 1600)

      const dx = Math.abs(x2 - swipeStart.current.x)
      const dy = Math.abs(y2 - swipeStart.current.y)

      if (dx > 20 || dy > 20) {
        // Swipe
        sendInput(focusedSerial, {
          type: "swipe",
          x: swipeStart.current.x,
          y: swipeStart.current.y,
          x2,
          y2,
          dur_ms: 200,
        })
      } else {
        // Tap
        sendInput(focusedSerial, { type: "tap", x: x2, y: y2 })
      }

      swipeStart.current = null
    },
    [focusedSerial, sendInput]
  )

  // Send LLM command
  const handleSendCommand = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return
    setChatLoading(true)
    setChatResponse("")
    try {
      const result = await sendLLMCommand(chatInput)
      setChatResponse(
        result.text || result.error || JSON.stringify(result, null, 2)
      )
    } catch (e: any) {
      setChatResponse(`Error: ${e.message}`)
    }
    setChatLoading(false)
    setChatInput("")
  }, [chatInput, chatLoading, sendLLMCommand])

  // Quick actions for focused device
  const quickAction = useCallback(
    (key: string) => {
      if (!focusedSerial) return
      sendInput(focusedSerial, { type: "key", key })
    },
    [focusedSerial, sendInput]
  )

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {t("phone_grid_title" as any) || "Phone Grid"}
          </h1>
          <div className={styles.subtitle}>
            {phones.length} devices • {Object.keys(screens).length} streaming
          </div>
        </div>
        <div className={styles.controls}>
          {!orchestratorUrl && (
            <input
              placeholder="Orchestrator URL"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6,
                padding: "6px 12px",
                color: "white",
                fontSize: 12,
                width: 280,
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const url = (e.target as HTMLInputElement).value.trim()
                  if (url) {
                    setOrchestratorUrl(url)
                    localStorage.setItem("orchestratorUrl", url)
                  }
                }
              }}
            />
          )}
          <span
            className={`${styles.statusDot} ${
              Object.keys(screens).length > 0 ? styles.online : styles.offline
            }`}
          />
        </div>
      </header>

      {/* Grid of phone screens */}
      <div className={styles.grid}>
        {phones.map((phone) => {
          const frame = screens[phone.serial || phone.phone_id]
          const serial = phone.serial || phone.phone_id
          return (
            <div
              key={serial}
              className={`${styles.phoneCard} ${
                focusedSerial === serial ? styles.focused : ""
              }`}
              onClick={() => focusDevice(serial)}
            >
              {frame?.thumbnail ? (
                <img
                  src={frame.thumbnail}
                  alt={serial}
                  className={styles.screenImage}
                />
              ) : (
                <div className={styles.screenPlaceholder}>
                  {serial.slice(-6)}
                </div>
              )}
              <div className={styles.cardOverlay}>
                <span className={styles.cardSerial}>{serial.slice(-6)}</span>
                <span
                  className={`${styles.cardStatus} ${
                    phone.status === "paused"
                      ? styles.paused
                      : phone.status === "offline"
                      ? styles.offline
                      : ""
                  }`}
                >
                  {phone.status}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Focus overlay (full screen view of one device) */}
      {focusedSerial && (
        <div className={styles.focusOverlay} onClick={(e) => {
          if (e.target === e.currentTarget) unfocusDevice()
        }}>
          <div className={styles.focusContainer}>
            <span className={styles.focusSerial}>{focusedSerial}</span>
            <button className={styles.focusClose} onClick={unfocusDevice}>
              ✕ Close
            </button>

            {screens[focusedSerial]?.thumbnail ? (
              <img
                ref={focusRef}
                src={screens[focusedSerial].thumbnail}
                alt={focusedSerial}
                className={styles.focusScreen}
                onClick={handleScreenClick}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                draggable={false}
              />
            ) : (
              <div
                className={styles.focusScreen}
                style={{
                  background: "#111",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#555",
                }}
              >
                Connecting...
              </div>
            )}

            <div className={styles.focusActions}>
              <button className={styles.focusBtn} onClick={() => quickAction("back")}>
                ← Back
              </button>
              <button className={styles.focusBtn} onClick={() => quickAction("home")}>
                ● Home
              </button>
              <button className={styles.focusBtn} onClick={() => quickAction("recent")}>
                ▢ Recent
              </button>
              <button className={styles.focusBtn} onClick={() => quickAction("power")}>
                ⏻ Power
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LLM Chat bar */}
      <div className={styles.chatBar}>
        <input
          className={styles.chatInput}
          placeholder={
            t("phone_grid_chat_placeholder" as any) ||
            "Command to Claude: 'post video on all active accounts' / 'pause device R83YA...'"
          }
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSendCommand()
            }
          }}
          disabled={chatLoading}
        />
        <button
          className={styles.chatSend}
          onClick={handleSendCommand}
          disabled={chatLoading || !chatInput.trim()}
        >
          {chatLoading ? "..." : t("phone_grid_send" as any) || "Send"}
        </button>
      </div>

      {/* Chat response */}
      {chatResponse && (
        <div className={styles.chatResponse}>
          {chatResponse}
        </div>
      )}
    </div>
  )
}
