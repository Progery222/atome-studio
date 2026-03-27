import { Injectable, Logger } from '@nestjs/common'
import { Service } from '@atome/shared'

/**
 * PostHog MCP Adapter
 *
 * Fetches Dashboards and Insights from PostHog API.
 * Orbit index: 1 | Color: #a78bfa (167,139,250)
 *
 * TODO: Replace stub with real PostHog API calls using PH_API_KEY + PH_PROJECT_ID.
 */
@Injectable()
export class PosthogAdapter {
  private readonly logger  = new Logger(PosthogAdapter.name)
  private readonly apiBase = 'https://app.posthog.com'
  private readonly apiKey  = process.env.PH_API_KEY ?? ''
  private readonly project = process.env.PH_PROJECT_ID ?? ''

  async fetchServices(): Promise<Service[]> {
    if (!this.apiKey || !this.project) {
      this.logger.warn('PH_API_KEY or PH_PROJECT_ID not set — using stub data')
      return this.stubData()
    }

    try {
      const [dashboards, insights] = await Promise.all([
        this.fetchDashboards(),
        this.fetchInsights(),
      ])
      return [...dashboards, ...insights]
    } catch (e) {
      this.logger.error('PostHog fetch failed', e)
      return this.stubData()
    }
  }

  private async fetchDashboards(): Promise<Service[]> {
    const res  = await fetch(`${this.apiBase}/api/projects/${this.project}/dashboards`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })
    const json = await res.json() as { results: { id: number; name: string; created_at: string }[] }

    return json.results.map((d, i) => ({
      id:       `ph-dashboard-${d.id}`,
      name:     d.name,
      platform: 'PostHog',
      type:     'Dashboard',
      status:   'online',
      modified: new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      col:      [167, 139, 250],
      oi:       1,
      a:        (i / 6) * Math.PI * 2,
      spd:      -(0.002 + Math.random() * 0.002),
    }))
  }

  private async fetchInsights(): Promise<Service[]> {
    const res  = await fetch(`${this.apiBase}/api/projects/${this.project}/insights?limit=10`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })
    const json = await res.json() as { results: { id: number; name: string; last_modified_at: string }[] }

    const purples: [number,number,number][] = [
      [167,139,250],[139,92,246],[99,60,220],[167,139,250],[130,110,255],[110,80,240],
    ]

    return json.results.map((ins, i) => ({
      id:       `ph-insight-${ins.id}`,
      name:     ins.name ?? `Insight ${ins.id}`,
      platform: 'PostHog',
      type:     'PH Insight',
      status:   'online',
      modified: new Date(ins.last_modified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      col:      purples[i % purples.length],
      oi:       i % 3,
      a:        (i / Math.max(json.results.length, 1)) * Math.PI * 2 + 0.62,
      spd:      (i % 2 === 0 ? 1 : -1) * (0.003 + Math.random() * 0.002),
    }))
  }

  private stubData(): Service[] {
    return [
      { id: 'ph-d-1', name: 'My App Dashboard',   platform: 'PostHog', type: 'Dashboard',  status: 'online', modified: 'Mar 27, 2026', col: [167,139,250], oi: 1, a: 0.62, spd: -0.0028 },
      { id: 'ph-i-1', name: 'Daily Active Users',  platform: 'PostHog', type: 'PH Insight', status: 'online', modified: 'Mar 27, 2026', col: [139,92,246],  oi: 2, a: 1.30, spd:  0.0055 },
      { id: 'ph-i-2', name: 'Weekly Active Users', platform: 'PostHog', type: 'PH Insight', status: 'online', modified: 'Mar 27, 2026', col: [99,60,220],   oi: 0, a: 2.10, spd:  0.0038 },
      { id: 'ph-i-3', name: 'Growth Accounting',   platform: 'PostHog', type: 'PH Insight', status: 'online', modified: 'Mar 27, 2026', col: [167,139,250], oi: 1, a: 3.50, spd: -0.0030 },
      { id: 'ph-i-4', name: 'Retention',           platform: 'PostHog', type: 'PH Insight', status: 'online', modified: 'Mar 27, 2026', col: [130,110,255], oi: 2, a: 4.20, spd:  0.0048 },
      { id: 'ph-i-5', name: 'Pageview Funnel',     platform: 'PostHog', type: 'PH Insight', status: 'online', modified: 'Mar 27, 2026', col: [110,80,240],  oi: 0, a: 5.00, spd:  0.0035 },
    ]
  }
}
