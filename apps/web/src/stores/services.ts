import { create } from 'zustand'
import { Service, ActivityMetrics } from '@atome/shared'

export interface TooltipData {
  x: number
  y: number
  service: Service
}

interface ServicesState {
  services: Service[]
  metrics: ActivityMetrics
  tooltip: TooltipData | null
  highlightedId: string | null

  setServices: (services: Service[]) => void
  updateServiceStatus: (id: string, status: Service['status']) => void
  setTooltip: (data: TooltipData | null) => void
  setHighlighted: (id: string | null) => void
  setMetrics: (metrics: ActivityMetrics) => void
}

// Demo data matching the prototype
const DEMO_SERVICES: Service[] = [
  { id: '0', name: 'tracker-worker',    platform: 'Cloudflare', type: 'CF Worker',      status: 'online', modified: 'Dec 3, 2025',  col: [249,115,22],  oi: 0, a: 0,    spd:  0.0042 },
  { id: '1', name: 'My App Dashboard',  platform: 'PostHog',    type: 'Dashboard',      status: 'online', modified: 'Mar 27, 2026', col: [167,139,250], oi: 1, a: 0.62, spd: -0.0028 },
  { id: '2', name: 'Daily Active Users',platform: 'PostHog',    type: 'PH Insight',     status: 'online', modified: 'Mar 27, 2026', col: [139,92,246],  oi: 2, a: 1.30, spd:  0.0055 },
  { id: '3', name: 'Weekly Active Users',platform: 'PostHog',   type: 'PH Insight',     status: 'online', modified: 'Mar 27, 2026', col: [99,60,220],   oi: 0, a: 2.10, spd:  0.0038 },
  { id: '4', name: 'Growth Accounting', platform: 'PostHog',    type: 'PH Insight',     status: 'online', modified: 'Mar 27, 2026', col: [167,139,250], oi: 1, a: 3.50, spd: -0.0030 },
  { id: '5', name: 'Retention',         platform: 'PostHog',    type: 'PH Insight',     status: 'online', modified: 'Mar 27, 2026', col: [130,110,255], oi: 2, a: 4.20, spd:  0.0048 },
  { id: '6', name: 'Pageview Funnel',   platform: 'PostHog',    type: 'PH Insight',     status: 'online', modified: 'Mar 27, 2026', col: [110,80,240],  oi: 0, a: 5.00, spd:  0.0035 },
  { id: '7', name: 'My Collection · A', platform: 'Postman',    type: 'API Collection', status: 'online', modified: 'Mar 27, 2026', col: [251,191,36],  oi: 1, a: 1.80, spd: -0.0024 },
  { id: '8', name: 'My Collection · B', platform: 'Postman',    type: 'API Collection', status: 'online', modified: 'Mar 27, 2026', col: [234,170,20],  oi: 2, a: 2.90, spd:  0.0052 },
  { id: '9', name: 'My Collection · C', platform: 'Postman',    type: 'API Collection', status: 'online', modified: 'Mar 27, 2026', col: [251,191,36],  oi: 0, a: 3.70, spd:  0.0040 },
]

const makeSparkPoints = () =>
  Array.from({ length: 40 }, (_, i) => ({ value: Math.random() * 100, ts: Date.now() - (40 - i) * 1000 }))

export const useServicesStore = create<ServicesState>((set) => ({
  services: DEMO_SERVICES,
  metrics: {
    eventsPerMin: makeSparkPoints(),
    apiCalls: makeSparkPoints(),
    latencyMs: makeSparkPoints(),
  },
  tooltip: null,
  highlightedId: null,

  setServices: (services) => set({ services }),
  updateServiceStatus: (id, status) =>
    set((s) => ({
      services: s.services.map((svc) => (svc.id === id ? { ...svc, status } : svc)),
    })),
  setTooltip: (tooltip) => set({ tooltip }),
  setHighlighted: (highlightedId) => set({ highlightedId }),
  setMetrics: (metrics) => set({ metrics }),
}))
