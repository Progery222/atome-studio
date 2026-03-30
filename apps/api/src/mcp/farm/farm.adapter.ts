import { Injectable, Logger } from '@nestjs/common'
import { Service, FarmStats, STATUS_COLORS, EMPTY_FARM_STATS } from '@atome/shared'

/**
 * Farm Adapter (Orchestrator)
 * Checks Orchestrator health at :8001 and fetches farm stats.
 * Orbit index: 2 | Color: green (online) / red (offline)
 */
@Injectable()
export class FarmAdapter {
  private readonly logger  = new Logger(FarmAdapter.name)
  private readonly baseUrl = process.env.ORCHESTRATOR_URL ?? 'http://localhost:8001'

  async fetchServices(): Promise<Service[]> {
    return []
  }

  async fetchFarmStats(): Promise<FarmStats> {
    try {
      const [statusRes, metricsRes] = await Promise.allSettled([
        fetch(`${this.baseUrl}/api/status`,  { signal: AbortSignal.timeout(3000) }),
        fetch(`${this.baseUrl}/api/metrics`, { signal: AbortSignal.timeout(3000) }),
      ])

      const stats: FarmStats = { ...EMPTY_FARM_STATS }

      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        const data = await statusRes.value.json() as Partial<FarmStats>
        stats.phones_online = data.phones_online ?? 0
        stats.phones_total  = data.phones_total  ?? 0
      }

      if (metricsRes.status === 'fulfilled' && metricsRes.value.ok) {
        const data = await metricsRes.value.json() as Partial<FarmStats>
        stats.accounts_active = data.accounts_active ?? 0
        stats.accounts_total  = data.accounts_total  ?? 0
        stats.posts_today     = data.posts_today     ?? 0
        stats.active_jobs     = data.active_jobs     ?? 0
        stats.last_event      = data.last_event
      }

      return stats
    } catch {
      this.logger.warn('Failed to fetch farm stats')
      return { ...EMPTY_FARM_STATS }
    }
  }
}
