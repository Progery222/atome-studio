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
    polling,
    setOrchestratorUrl,
    startPolling,
    stopPolling,
    focusDevice,
    unfocusDevice,
    sendInput,
    sendLLMCommand,
  } = usePhoneGridStore()

  const [chatInput, setChatInput] = useState("")
  const [chatResponse, setChatResponse] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const focusRef = useRef<HTMLImageElement>(null)

  // Load saved URL
  useEffect(() => {
    if (!orchestratorUrl) {
      const saved = localStorage.getItem("orchestratorUrl")
      if (saved) setOrchestratorUrl(saved)
    }
  }, [orchestratorUrl, setOrchestratorUrl])

  // Start polling when we have URL + phones
  useEffect(() => {
    if (orchestratorUrl && phones.length > 0) {
      const serials = phones.map((p: any) => p.serial || p.phone_id)
      startPolling(serials)
      return () => stopPolling()
    }
  }, [orchestratorUrl, phones, startPolling, stopPolling])

  // Fetch phones periodically
  useEffect(() => {
    fetchPhones()
    const id = setInterval(fetchPhones, 15_000)
    return () => clearInterval(id)
  }, [fetchPhones])

  // Handle click on focused screen → send tap
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

  // Swipe detection
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!focusRef.current) return
      const rect = focusRef.current.getBoundingClientRect()
      swipeStart.current = {
        x: Math.round(((e.clientX - rect.left) / rect.width) * 720),
        y: Math.round(((e.clientY - rect.top) / rect.height) * 1600),
      }
    },
    []
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!focusedSerial || !focusRef.current || !swipeStart.current) return
      const rect = focusRef.current.getBoundingClientRect()
      const x2 = Math.round(((e.clientX - rect.left) / rect.width) * 720)
      const y2 = Math.round(((e.clientY - rect.top) / rect.height) * 1600)
      const dx = Math.abs(x2 - swipeStart.current.x)
      const dy = Math.abs(y2 - swipeStart.current.y)

      if (dx > 20 || dy > 20) {
        sendInput(focusedSerial, {
          type: "swipe",
          x: swipeStart.current.x,
          y: swipeStart.current.y,
          x2,
          y2,
          dur_ms: 200,
        })
      } else {
        sendInput(focusedSerial, { type: "tap", x: x2, y: y2 })
      }
      swipeStart.current = null
    },
    [focusedSerial, sendInput]
  )

  // LLM command
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

  const quickAction = useCallback(
    (key: string) => {
      if (!focusedSerial) return
      sendInput(focusedSerial, { type: "key", key })
    },
    [focusedSerial, sendInput]
  )

  const streamingCount = Object.values(screens).filter(
    (s) => s.ts > Date.now() - 5000
  ).length

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Phone Grid</h1>
          <div className={styles.subtitle}>
            {phones.length} devices • {streamingCount} streaming
            {polling && " • 🟢 live"}
          </div>
        </div>
        <div className={styles.controls}>
          {!orchestratorUrl ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (urlInput.trim()) setOrchestratorUrl(urlInput.trim())
              }}
              style={{ display: "flex", gap: 8 }}
            >
              <input
                placeholder="Orchestrator URL (https://...trycloudflare.com)"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 6,
                  padding: "6px 12px",
                  color: "white",
                  fontSize: 12,
                  width: 350,
                }}
              />
              <button
                type="submit"
                style={{
                  background: "var(--accent-cyan, #00d2ff)",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 14px",
                  color: "#000",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Connect
              </button>
            </form>
          ) : (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
              {orchestratorUrl.replace("https://", "").slice(0, 30)}...
            </span>
          )}
          <span
            className={`${styles.statusDot} ${
              streamingCount > 0 ? styles.online : styles.offline
            }`}
          />
        </div>
      </header>

      {/* Grid */}
      <div className={styles.grid}>
        {phones.map((phone: any) => {
          const serial = phone.serial || phone.phone_id
          const frame = screens[serial]
          const isLive = frame && frame.ts > Date.now() - 5000
          return (
            <div
              key={serial}
              className={`${styles.phoneCard} ${
                focusedSerial === serial ? styles.focused : ""
              }`}
              onClick={() => focusDevice(serial)}
            >
              {isLive && frame.thumbnail ? (
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

      {/* Focus overlay */}
      {focusedSerial && (
        <div
          className={styles.focusOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) unfocusDevice()
          }}
        >
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
                Loading...
              </div>
            )}

            <div className={styles.focusActions}>
              <button
                className={styles.focusBtn}
                onClick={() => quickAction("back")}
              >
                ← Back
              </button>
              <button
                className={styles.focusBtn}
                onClick={() => quickAction("home")}
              >
                ● Home
              </button>
              <button
                className={styles.focusBtn}
                onClick={() => quickAction("recent")}
              >
                ▢ Recent
              </button>
              <button
                className={styles.focusBtn}
                onClick={() => quickAction("power")}
              >
                ⏻ Power
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LLM Chat */}
      <div className={styles.chatBar}>
        <input
          className={styles.chatInput}
          placeholder="Claude command: 'post video on active accounts' / 'pause all' / 'analyze engagement'..."
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
          {chatLoading ? "..." : "Send"}
        </button>
      </div>

      {chatResponse && (
        <div className={styles.chatResponse}>{chatResponse}</div>
      )}
    </div>
  )
}
