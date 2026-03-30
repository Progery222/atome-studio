import { create } from 'zustand'
import { Phone, Account, QueueTask, GenerationJob, FarmEvent, VideoFile } from '@atome/shared'

interface FarmState {
  phones:          Phone[]
  accounts:        Account[]
  queue:           QueueTask[]
  activeJobs:      GenerationJob[]
  videos:          VideoFile[]
  phonesLoading:   boolean
  accountsLoading: boolean
  queueLoading:    boolean
  videosLoading:   boolean
  wsConnected:     boolean
  lastEvent:       FarmEvent | null
  _pollId:         ReturnType<typeof setInterval> | null

  fetchPhones:    () => Promise<void>
  fetchAccounts:  () => Promise<void>
  fetchQueue:     () => Promise<void>
  fetchJobs:      () => Promise<void>
  fetchVideos:    () => Promise<void>
  pausePhone:     (id: string) => Promise<void>
  resumePhone:    (id: string) => Promise<void>
  createAccount:  (data: Partial<Account>) => Promise<Account | null>
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
  phones:          [],
  accounts:        [],
  queue:           [],
  activeJobs:      [],
  videos:          [],
  phonesLoading:   false,
  accountsLoading: false,
  queueLoading:    false,
  videosLoading:   false,
  wsConnected:     false,
  lastEvent:       null,
  _pollId:         null,

  fetchPhones: async () => {
    set({ phonesLoading: true })
    try {
      const res    = await fetch('/api/phones')
      const phones = await res.json() as Phone[]
      set({ phones, phonesLoading: false })
    } catch {
      set({ phonesLoading: false })
    }
  },

  fetchAccounts: async () => {
    set({ accountsLoading: true })
    try {
      const res      = await fetch('/api/accounts')
      const accounts = await res.json() as Account[]
      set({ accounts, accountsLoading: false })
    } catch {
      set({ accountsLoading: false })
    }
  },

  fetchQueue: async () => {
    set({ queueLoading: true })
    try {
      const res   = await fetch('/api/queue')
      const queue = await res.json() as QueueTask[]
      set({ queue, queueLoading: false })
    } catch {
      set({ queueLoading: false })
    }
  },

  fetchJobs: async () => {
    try {
      const res  = await fetch('/api/jobs')
      const jobs = await res.json() as GenerationJob[]
      set({ activeJobs: jobs })
    } catch {
      // silently ignore
    }
  },

  fetchVideos: async () => {
    set({ videosLoading: true })
    try {
      const res    = await fetch('/api/videos')
      const videos = await res.json() as VideoFile[]
      set({ videos, videosLoading: false })
    } catch {
      set({ videosLoading: false })
    }
  },

  pausePhone: async (id) => {
    await fetch(`/api/phones/${id}/pause`, { method: 'POST' })
    get().fetchPhones()
  },

  resumePhone: async (id) => {
    await fetch(`/api/phones/${id}/resume`, { method: 'POST' })
    get().fetchPhones()
  },

  createAccount: async (data) => {
    try {
      const res     = await fetch('/api/accounts', {
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

  startGeneration: async (data) => {
    try {
      const endpoint = data.service === 'sportzavod'
        ? '/api/sportzavod/generate'
        : '/api/contentzavod/generate'
      const res = await fetch(endpoint, {
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
      await fetch(`/api/jobs/${jobId}/stop`, { method: 'POST' })
      await get().fetchJobs()
    } catch {
      // silently ignore
    }
  },

  connectWs: () => {
    const existing = get()._pollId
    if (existing !== null) return // already polling

    const poll = () => {
      get().fetchQueue()
      get().fetchJobs()
    }
    poll() // immediate first call
    const id = setInterval(poll, 10_000)
    set({ wsConnected: true, _pollId: id })
  },

  disconnectWs: () => {
    const id = get()._pollId
    if (id !== null) clearInterval(id)
    set({ wsConnected: false, _pollId: null })
  },
}))
