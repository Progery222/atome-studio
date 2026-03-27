import { Injectable, Logger } from '@nestjs/common'
import { Service } from '@atome/shared'

/**
 * Cloudflare MCP Adapter
 *
 * Fetches Workers, R2 Buckets, KV Namespaces, D1 Databases from Cloudflare API.
 * Orbit index: 0 | Color: #f97316 (249,115,22)
 *
 * TODO: Replace stub with real Cloudflare API calls using CF_API_TOKEN + CF_ACCOUNT_ID.
 */
@Injectable()
export class CloudflareAdapter {
  private readonly logger = new Logger(CloudflareAdapter.name)
  private readonly apiBase = 'https://api.cloudflare.com/client/v4'
  private readonly token   = process.env.CF_API_TOKEN ?? ''
  private readonly account = process.env.CF_ACCOUNT_ID ?? ''

  async fetchServices(): Promise<Service[]> {
    if (!this.token || !this.account) {
      this.logger.warn('CF_API_TOKEN or CF_ACCOUNT_ID not set — using stub data')
      return this.stubData()
    }

    try {
      const workers = await this.fetchWorkers()
      return workers
    } catch (e) {
      this.logger.error('Cloudflare fetch failed', e)
      return this.stubData()
    }
  }

  private async fetchWorkers(): Promise<Service[]> {
    const res = await fetch(`${this.apiBase}/accounts/${this.account}/workers/scripts`, {
      headers: { Authorization: `Bearer ${this.token}` },
    })
    const json = await res.json() as { result: { id: string; created_on: string }[] }

    return json.result.map((w, i) => ({
      id:       `cf-worker-${w.id}`,
      name:     w.id,
      platform: 'Cloudflare',
      type:     'CF Worker',
      status:   'online',
      modified: new Date(w.created_on).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      col:      [249, 115, 22],
      oi:       0,
      a:        (i / Math.max(json.result.length, 1)) * Math.PI * 2,
      spd:      0.003 + Math.random() * 0.003,
    }))
  }

  private stubData(): Service[] {
    return [{
      id:       'cf-worker-tracker',
      name:     'tracker-worker',
      platform: 'Cloudflare',
      type:     'CF Worker',
      status:   'online',
      modified: 'Dec 3, 2025',
      col:      [249, 115, 22],
      oi:       0,
      a:        0,
      spd:      0.0042,
    }]
  }
}
