import { create } from 'zustand'
import { Service, FarmStats, EMPTY_FARM_STATS } from '@atome/shared'

const API = '/api'

export interface TooltipData {
  x: number
  y: number
  service: Service
}

interface ServicesState {
  services:      Service[]
  farmStats:     FarmStats
  tooltip:       TooltipData | null
  highlightedId: string | null
  selectedId:    string | null
  loading:       boolean

  setServices:    (services: Service[]) => void
  setFarmStats:   (stats: FarmStats) => void
  setTooltip:     (data: TooltipData | null) => void
  setHighlighted: (id: string | null) => void
  setSelected:    (id: string | null) => void

  fetchServices: () => Promise<void>
  fetchStats:    () => Promise<void>
}

export const useServicesStore = create<ServicesState>((set) => ({
  services:      [],
  farmStats:     { ...EMPTY_FARM_STATS },
  tooltip:       null,
  highlightedId: null,
  selectedId:    null,
  loading:       true,

  setServices:    (services)   => set({ services }),
  setFarmStats:   (farmStats)  => set({ farmStats }),
  setTooltip:     (tooltip)    => set({ tooltip }),
  setHighlighted: (highlightedId) => set({ highlightedId }),
  setSelected:    (selectedId) => set({ selectedId }),

  fetchServices: async () => {
    try {
      const res      = await fetch(`${API}/services`)
      const services = await res.json() as Service[]
      set({ services, loading: false })
    } catch (e) {
      console.warn('Failed to fetch services', e)
      set({ loading: false })
    }
  },

  fetchStats: async () => {
    try {
      const res   = await fetch(`${API}/services/stats`)
      const stats = await res.json() as FarmStats
      set({ farmStats: stats })
    } catch (e) {
      console.warn('Failed to fetch farm stats', e)
    }
  },
}))
