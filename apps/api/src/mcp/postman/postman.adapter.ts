import { Injectable, Logger } from '@nestjs/common'
import { Service } from '@atome/shared'

/**
 * Postman MCP Adapter
 *
 * Fetches Collections from Postman API.
 * Orbit index: 2 | Color: #fbbf24 (251,191,36)
 *
 * TODO: Replace stub with real Postman API calls using POSTMAN_API_KEY.
 */
@Injectable()
export class PostmanAdapter {
  private readonly logger  = new Logger(PostmanAdapter.name)
  private readonly apiBase = 'https://api.getpostman.com'
  private readonly apiKey  = process.env.POSTMAN_API_KEY ?? ''

  async fetchServices(): Promise<Service[]> {
    if (!this.apiKey) {
      this.logger.warn('POSTMAN_API_KEY not set — using stub data')
      return this.stubData()
    }

    try {
      return await this.fetchCollections()
    } catch (e) {
      this.logger.error('Postman fetch failed', e)
      return this.stubData()
    }
  }

  private async fetchCollections(): Promise<Service[]> {
    const res  = await fetch(`${this.apiBase}/collections`, {
      headers: { 'X-Api-Key': this.apiKey },
    })
    const json = await res.json() as { collections: { uid: string; name: string; updatedAt: string }[] }

    const ambers: [number,number,number][] = [[251,191,36],[234,170,20],[251,191,36]]

    return json.collections.map((c, i) => ({
      id:       `pm-col-${c.uid}`,
      name:     c.name,
      platform: 'Postman',
      type:     'API Collection',
      status:   'online',
      modified: new Date(c.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      col:      ambers[i % ambers.length],
      oi:       2,
      a:        1.80 + i * 1.1,
      spd:      (i % 2 === 0 ? -1 : 1) * (0.002 + Math.random() * 0.003),
    }))
  }

  private stubData(): Service[] {
    return [
      { id: 'pm-col-a', name: 'My Collection · A', platform: 'Postman', type: 'API Collection', status: 'online', modified: 'Mar 27, 2026', col: [251,191,36], oi: 1, a: 1.80, spd: -0.0024 },
      { id: 'pm-col-b', name: 'My Collection · B', platform: 'Postman', type: 'API Collection', status: 'online', modified: 'Mar 27, 2026', col: [234,170,20], oi: 2, a: 2.90, spd:  0.0052 },
      { id: 'pm-col-c', name: 'My Collection · C', platform: 'Postman', type: 'API Collection', status: 'online', modified: 'Mar 27, 2026', col: [251,191,36], oi: 0, a: 3.70, spd:  0.0040 },
    ]
  }
}
