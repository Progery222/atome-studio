import { Injectable, Logger } from '@nestjs/common'
import { Service } from '@atome/shared'
import { CloudflareAdapter } from './cloudflare/cloudflare.adapter'
import { PosthogAdapter } from './posthog/posthog.adapter'
import { PostmanAdapter } from './postman/postman.adapter'

/**
 * Aggregates data from all MCP adapters into a unified Service list.
 * Called on a schedule by ServicesService.
 */
@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name)

  constructor(
    private readonly cloudflare: CloudflareAdapter,
    private readonly posthog: PosthogAdapter,
    private readonly postman: PostmanAdapter,
  ) {}

  async fetchAllServices(): Promise<Service[]> {
    const results = await Promise.allSettled([
      this.cloudflare.fetchServices(),
      this.posthog.fetchServices(),
      this.postman.fetchServices(),
    ])

    const services: Service[] = []
    const names = ['Cloudflare', 'PostHog', 'Postman']

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        services.push(...result.value)
      } else {
        this.logger.warn(`${names[i]} adapter failed: ${result.reason}`)
      }
    })

    return services
  }
}
