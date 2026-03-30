import { Injectable, Logger } from '@nestjs/common'
import { Service, FarmStats, EMPTY_FARM_STATS } from '@atome/shared'
import { SportZavodAdapter } from './sportzavod/sportzavod.adapter'
import { ContentZavodAdapter } from './contentzavod/contentzavod.adapter'
import { FarmAdapter } from './farm/farm.adapter'

/**
 * Aggregates data from all service adapters.
 * Called on a schedule by ServicesService.
 */
@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name)

  constructor(
    private readonly sportzavod:   SportZavodAdapter,
    private readonly contentzavod: ContentZavodAdapter,
    private readonly farm:         FarmAdapter,
  ) {}

  async fetchAllServices(): Promise<Service[]> {
    const results = await Promise.allSettled([
      this.sportzavod.fetchServices(),
      this.contentzavod.fetchServices(),
      this.farm.fetchServices(),
    ])

    const services: Service[] = []
    const names = ['SportZavod', 'content-zavod', 'Orchestrator']

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        services.push(...result.value)
      } else {
        this.logger.warn(`${names[i]} adapter failed: ${result.reason}`)
      }
    })

    return services
  }

  async fetchFarmStats(): Promise<FarmStats> {
    try {
      return await this.farm.fetchFarmStats()
    } catch (e) {
      this.logger.warn(`FarmStats fetch failed: ${e}`)
      return { ...EMPTY_FARM_STATS }
    }
  }
}
