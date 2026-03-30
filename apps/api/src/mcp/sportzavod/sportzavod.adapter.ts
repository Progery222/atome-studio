import { Injectable, Logger } from '@nestjs/common'
import { Service, STATUS_COLORS } from '@atome/shared'

/**
 * SportZavod Adapter
 * Checks SportZavod service health at :8000 and fetches active jobs.
 * Orbit index: 0 | Color: green (online) / red (offline)
 */
@Injectable()
export class SportZavodAdapter {
  private readonly logger  = new Logger(SportZavodAdapter.name)
  private readonly baseUrl = process.env.SPORTZAVOD_URL ?? 'http://localhost:8000'

  async fetchServices(): Promise<Service[]> {
    let status: Service['status'] = 'offline'
    let activeJobs = 0

    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        status = 'online'
        activeJobs = await this.fetchActiveJobs()
      } else {
        status = 'degraded'
      }
    } catch {
      this.logger.warn('SportZavod unavailable')
    }

    return [{
      id:         'sportzavod',
      name:       'SportZavod',
      status,
      col:        STATUS_COLORS[status],
      oi:         0,
      a:          0,
      spd:        0.0035,
      activeJobs,
    }]
  }

  private async fetchActiveJobs(): Promise<number> {
    try {
      const res  = await fetch(`${this.baseUrl}/api/jobs`, { signal: AbortSignal.timeout(3000) })
      const jobs = await res.json() as { status: string }[]
      return jobs.filter((j) => j.status === 'running').length
    } catch {
      return 0
    }
  }
}
