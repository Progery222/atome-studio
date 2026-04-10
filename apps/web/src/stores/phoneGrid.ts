import { create } from "zustand"

export interface ScreenFrame {
  serial: string
  ts: number
  thumbnail?: string // base64 JPEG
  blob?: Blob
}

interface PhoneGridState {
  // Grid state
  screens: Record<string, ScreenFrame> // serial → latest frame
  focusedSerial: string | null
  focusStream: "scrcpy" | "mjpeg" | null
  gridWs: WebSocket | null
  focusWs: WebSocket | null

  // Config
  orchestratorUrl: string

  // Actions
  setOrchestratorUrl: (url: string) => void
  connectGrid: () => void
  disconnectGrid: () => void
  focusDevice: (serial: string) => void
  unfocusDevice: () => void
  sendInput: (serial: string, event: InputEvent) => Promise<void>
  sendLLMCommand: (prompt: string) => Promise<any>
}

interface InputEvent {
  type: "tap" | "swipe" | "key" | "text"
  x?: number
  y?: number
  x2?: number
  y2?: number
  dur_ms?: number
  key?: string
  text?: string
}

export const usePhoneGridStore = create<PhoneGridState>((set, get) => ({
  screens: {},
  focusedSerial: null,
  focusStream: null,
  gridWs: null,
  focusWs: null,
  orchestratorUrl: "",

  setOrchestratorUrl: (url) => set({ orchestratorUrl: url }),

  connectGrid: () => {
    const { orchestratorUrl, gridWs: existing } = get()
    if (existing) return

    const wsUrl = orchestratorUrl.replace("https://", "wss://").replace("http://", "ws://")
    const ws = new WebSocket(`${wsUrl}/ws/screens`)

    let pendingSerial = ""

    ws.onmessage = (evt) => {
      if (typeof evt.data === "string") {
        // Text = header JSON
        try {
          const header = JSON.parse(evt.data)
          pendingSerial = header.serial
        } catch {}
      } else {
        // Binary = JPEG thumbnail
        if (pendingSerial) {
          const blob = new Blob([evt.data], { type: "image/jpeg" })
          const url = URL.createObjectURL(blob)

          set((state) => ({
            screens: {
              ...state.screens,
              [pendingSerial]: {
                serial: pendingSerial,
                ts: Date.now(),
                thumbnail: url,
                blob: blob,
              },
            },
          }))
          pendingSerial = ""
        }
      }
    }

    ws.onclose = () => {
      set({ gridWs: null })
      // Reconnect in 3s
      setTimeout(() => get().connectGrid(), 3000)
    }

    ws.onerror = () => ws.close()

    set({ gridWs: ws })
  },

  disconnectGrid: () => {
    const { gridWs } = get()
    if (gridWs) {
      gridWs.close()
      set({ gridWs: null })
    }
  },

  focusDevice: (serial) => {
    const { orchestratorUrl, focusWs: existing } = get()

    // Close previous focus
    if (existing) existing.close()

    const wsUrl = orchestratorUrl.replace("https://", "wss://").replace("http://", "ws://")
    const ws = new WebSocket(`${wsUrl}/ws/screen/${serial}`)

    ws.binaryType = "arraybuffer"

    ws.onmessage = (evt) => {
      if (typeof evt.data === "string") {
        try {
          const info = JSON.parse(evt.data)
          if (info.type === "init") {
            set({ focusStream: info.codec as any })
          }
        } catch {}
      } else {
        // Binary frame (MJPEG JPEG or H.264 NAL)
        const { focusStream } = get()
        if (focusStream === "mjpeg") {
          const blob = new Blob([evt.data], { type: "image/jpeg" })
          const url = URL.createObjectURL(blob)
          set((state) => ({
            screens: {
              ...state.screens,
              [serial]: { serial, ts: Date.now(), thumbnail: url, blob },
            },
          }))
        }
        // H.264: would need MSE decoder — for now use MJPEG fallback
      }
    }

    ws.onclose = () => set({ focusWs: null })
    ws.onerror = () => ws.close()

    set({ focusedSerial: serial, focusWs: ws })
  },

  unfocusDevice: () => {
    const { focusWs } = get()
    if (focusWs) focusWs.close()
    set({ focusedSerial: null, focusWs: null, focusStream: null })
  },

  sendInput: async (serial, event) => {
    const { orchestratorUrl } = get()
    await fetch(`${orchestratorUrl}/api/devices/${serial}/input`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    })
  },

  sendLLMCommand: async (prompt) => {
    const { orchestratorUrl } = get()
    const res = await fetch(`${orchestratorUrl}/api/brain/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    })
    return res.json()
  },
}))
