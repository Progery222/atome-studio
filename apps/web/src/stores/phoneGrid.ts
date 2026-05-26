import { create } from "zustand"

export interface ScreenFrame {
  serial: string
  ts: number
  thumbnail?: string // object URL for JPEG blob
}

interface PhoneGridState {
  screens: Record<string, ScreenFrame>
  focusedSerial: string | null
  farmBackendUrl: string
  polling: boolean
  pollTimer: ReturnType<typeof setInterval> | null
  focusPollTimer: ReturnType<typeof setInterval> | null

  setFarmBackendUrl: (url: string) => void
  startPolling: (serials: string[]) => void
  stopPolling: () => void
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

async function fetchScreenshot(
  url: string,
  serial: string,
  thumb: boolean
): Promise<string | null> {
  try {
    const res = await fetch(
      `${url}/api/screen/${serial}${thumb ? "?thumb=1" : ""}`,
      { mode: "cors" }
    )
    if (!res.ok) return null
    const blob = await res.blob()
    if (blob.size < 100) return null
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

export const usePhoneGridStore = create<PhoneGridState>((set, get) => ({
  screens: {},
  focusedSerial: null,
  farmBackendUrl: "",
  polling: false,
  pollTimer: null,
  focusPollTimer: null,

  setFarmBackendUrl: (url) => {
    localStorage.setItem("farmBackendUrl", url)
    set({ farmBackendUrl: url })
  },

  startPolling: (serials) => {
    const { farmBackendUrl, pollTimer: existing } = get()
    if (!farmBackendUrl || existing) return

    const poll = async () => {
      const { farmBackendUrl: url, focusedSerial } = get()
      if (!url) return

      // Fetch thumbnails for all devices in parallel
      const results = await Promise.allSettled(
        serials.map(async (serial) => {
          // Skip focused device (it has its own fast poll)
          if (serial === focusedSerial) return null
          const thumb = await fetchScreenshot(url, serial, true)
          return thumb ? { serial, thumb } : null
        })
      )

      const updates: Record<string, ScreenFrame> = {}
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          const { serial, thumb } = r.value
          // Revoke old URL to prevent memory leak
          const old = get().screens[serial]?.thumbnail
          if (old) URL.revokeObjectURL(old)
          updates[serial] = { serial, ts: Date.now(), thumbnail: thumb }
        }
      }

      if (Object.keys(updates).length > 0) {
        set((s) => ({ screens: { ...s.screens, ...updates }, polling: true }))
      }
    }

    // Initial poll
    poll()
    // Every 1.5s for thumbnails
    const timer = setInterval(poll, 1500)
    set({ pollTimer: timer, polling: true })
  },

  stopPolling: () => {
    const { pollTimer, focusPollTimer } = get()
    if (pollTimer) clearInterval(pollTimer)
    if (focusPollTimer) clearInterval(focusPollTimer)
    set({ pollTimer: null, focusPollTimer: null, polling: false })
  },

  focusDevice: (serial) => {
    const { farmBackendUrl, focusPollTimer: existing } = get()
    if (existing) clearInterval(existing)
    if (!farmBackendUrl) return

    // Fast poll for focused device (full quality, 5fps)
    const poll = async () => {
      const url = get().farmBackendUrl
      if (!url) return
      const img = await fetchScreenshot(url, serial, false)
      if (img) {
        const old = get().screens[serial]?.thumbnail
        if (old) URL.revokeObjectURL(old)
        set((s) => ({
          screens: {
            ...s.screens,
            [serial]: { serial, ts: Date.now(), thumbnail: img },
          },
        }))
      }
    }

    poll()
    const timer = setInterval(poll, 200) // 5fps full quality
    set({ focusedSerial: serial, focusPollTimer: timer })
  },

  unfocusDevice: () => {
    const { focusPollTimer } = get()
    if (focusPollTimer) clearInterval(focusPollTimer)
    set({ focusedSerial: null, focusPollTimer: null })
  },

  sendInput: async (serial, event) => {
    const { farmBackendUrl } = get()
    try {
      await fetch(`${farmBackendUrl}/api/input/${serial}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
        mode: "cors",
      })
    } catch (e) {
      console.warn("sendInput failed:", e)
    }
  },

  sendLLMCommand: async (prompt) => {
    const { farmBackendUrl } = get()
    const res = await fetch(`${farmBackendUrl}/api/brain/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      mode: "cors",
    })
    return res.json()
  },
}))
