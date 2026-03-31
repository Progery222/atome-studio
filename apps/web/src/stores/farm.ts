import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'
import { Phone, Account, QueueTask, GenerationJob, FarmEvent, VideoFile } from '@atome/shared'
import { apiFetch } from '../lib/api'

interface FarmState {
  phones:                   Phone[]
  accounts:                 Account[]
  sportzavodAccounts:       Account[]
  queue:                    QueueTask[]
  activeJobs:               GenerationJob[]
  videos:                   VideoFile[]
  phonesLoading:            boolean
  accountsLoading:          boolean
  sportzavodAccountsLoading: boolean
  queueLoading:             boolean
  videosLoading:            boolean
  wsConnected:              boolean
  lastEvent:                FarmEvent | null
  _socket:                  Socket | null

  fetchPhones:              () => Promise<void>
  fetchAccounts:            () => Promise<void>
  fetchSportzavodAccounts:  () => Promise<void>
  fetchQueue:     () => Promise<void>
  fetchJobs:      () => Promise<void>
  fetchVideos:    () => Promise<void>
  pausePhone:     (id: string) => Promise<void>
  resumePhone:    (id: string) => Promise<void>
  createAccount:  (data: Partial<Account>) => Promise<Account | null>
  updateAccount:  (id: string, data: Partial<Account>) => Promise<Account | null>
  reloadFromSheets: () => Promise<boolean>
  startGeneration: (data: {
    service: 'sportzavod' | 'contentzavod'
    account_ids: string[]
    videos_per_account: number
    topic?: string
  }) => Promise<GenerationJob | null>
  stopJob:        (jobId: string) => Promise<void>
  connectWs:      () => void
  disconnectWs:   () => void
}

export const useFarmStore = create<FarmState>((set, get) => ({
  phones:                    [],
  accounts:                  [],
  sportzavodAccounts:        [],
  queue:                     [],
  activeJobs:                [],
  videos:                    [],
  phonesLoading:             false,
  accountsLoading:           false,
  sportzavodAccountsLoading: false,
  queueLoading:              false,
  videosLoading:             false,
  wsConnected:               false,
  lastEvent:                 null,
  _socket:                   null,

  fetchPhones: async () => {
    set({ phonesLoading: true })
    try {
      const res    = await apiFetch('/api/phones')
      const phones = await res.json() as Phone[]
      set({ phones, phonesLoading: false })
    } catch {
      set({ phonesLoading: false })
    }
  },

  fetchAccounts: async () => {
    set({ accountsLoading: true })
    try {
      const res      = await apiFetch('/api/accounts')
      const accounts = await res.json() as Account[]
      set({ accounts, accountsLoading: false })
    } catch {
      set({ accountsLoading: false })
    }
  },

  fetchSportzavodAccounts: async () => {
    set({ sportzavodAccountsLoading: true })
    try {
      const res                = await apiFetch('/api/sportzavod/accounts')
      const sportzavodAccounts = await res.json() as Account[]
      set({ sportzavodAccounts, sportzavodAccountsLoading: false })
    } catch {
      set({ sportzavodAccountsLoading: false })
    }
  },

  fetchQueue: async () => {
    set({ queueLoading: true })
    try {
      const res   = await apiFetch('/api/queue')
      const queue = await res.json() as QueueTask[]
      set({ queue, queueLoading: false })
    } catch {
      set({ queueLoading: false })
    }
  },

  fetchJobs: async () => {
    try {
      const res  = await apiFetch('/api/jobs')
      const jobs = await res.json() as GenerationJob[]
      set({ activeJobs: jobs })
    } catch {
      // silently ignore
    }
  },

  fetchVideos: async () => {
    set({ videosLoading: true })
    try {
      const res    = await apiFetch('/api/videos')
      const videos = await res.json() as VideoFile[]
      set({ videos, videosLoading: false })
    } catch {
      set({ videosLoading: false })
    }
  },

  pausePhone: async (id) => {
    await apiFetch(`/api/phones/${id}/pause`, { method: 'POST' })
    get().fetchPhones()
  },

  resumePhone: async (id) => {
    await apiFetch(`/api/phones/${id}/resume`, { method: 'POST' })
    get().fetchPhones()
  },

  createAccount: async (data) => {
    try {
      const res     = await apiFetch('/api/accounts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      const account = await res.json() as Account
      set((s) => ({ accounts: [...s.accounts, account] }))
      return account
    } catch {
      return null
    }
  },

  updateAccount: async (id, data) => {
    try {
      const res     = await apiFetch(`/api/accounts/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      if (!res.ok) return null
      const account = await res.json() as Account
      set((s) => ({
        accounts: s.accounts.map((a) => a.account_id === id ? account : a),
      }))
      return account
    } catch {
      return null
    }
  },

  reloadFromSheets: async () => {
    try {
      const res = await apiFetch('/api/sportzavod/accounts/reload', { method: 'POST' })
      if (!res.ok) return false
      await get().fetchAccounts()
      return true
    } catch {
      return false
    }
  },

  startGeneration: async (data) => {
    try {
      const res = await apiFetch('/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          account_ids:         data.account_ids,
          videos_per_account:  data.videos_per_account,
          topic:               data.topic,
        }),
      })
      const job = await res.json() as GenerationJob
      set((s) => ({ activeJobs: [...s.activeJobs, job] }))
      return job
    } catch {
      return null
    }
  },

  stopJob: async (jobId) => {
    try {
      await apiFetch(`/api/jobs/${jobId}/stop`, { method: 'POST' })
      await get().fetchJobs()
    } catch {
      // silently ignore
    }
  },

  connectWs: () => {
    const existing = get()._socket
    if (existing) return // already connected

    // Connect via Vite proxy to NestJS /ws namespace
    const socket = io('/ws', { transports: ['websocket', 'polling'] })

    socket.on('connect', () => {
      set({ wsConnected: true })
      get().fetchQueue()
      get().fetchJobs()
    })

    socket.on('disconnect', () => {
      set({ wsConnected: false })
    })

    socket.on('farm_event', (event: FarmEvent) => {
      set({ lastEvent: event })
      
      switch (event.event) {
        case 'published':
          get().fetchQueue()
          get().fetchPhones() // update post counts
          break
        case 'failed':
        case 'error':
          get().fetchQueue()
          break
        case 'job_complete':
          get().fetchJobs()
          get().fetchVideos()
          break
        case 'banned':
          get().fetchPhones()
          break
        case 'heartbeat':
          // Update phone status from heartbeat payload (FR-16.4)
          if (event.phone_id && event.details) {
            set((s) => ({
              phones: s.phones.map((p) =>
                p.phone_id === event.phone_id
                  ? { ...p, ...event.details as Partial<Phone>, last_active: event.timestamp }
                  : p
              ),
            }))
          }
          break
      }
    })

    set({ _socket: socket })
  },

  disconnectWs: () => {
    const socket = get()._socket
    if (socket) {
      socket.disconnect()
      set({ _socket: null, wsConnected: false })
    }
  },
}))
