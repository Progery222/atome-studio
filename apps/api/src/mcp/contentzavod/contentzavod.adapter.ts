import { Injectable, Logger } from '@nestjs/common'
import { Service, STATUS_COLORS } from '@atome/shared'

/**
 * content-zavod Adapter
 * Checks content-zavod service health at :8002.
 * Orbit index: 1 | Color: green (online) / red (offline)
 */
@Injectable()
export class ContentZavodAdapter {
  private readonly logger  = new Logger(ContentZavodAdapter.name)
  private readonly baseUrl = process.env.CONTENTZAVOD_URL ?? 'http://localhost:8002'

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
      this.logger.warn('content-zavod unavailable')
    }

    return [{
      id:         'contentzavod',
      name:       'content-zavod',
      status,
      col:        STATUS_COLORS[status],
      oi:         1,
      a:          Math.PI,
      spd:        -0.0028,
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
