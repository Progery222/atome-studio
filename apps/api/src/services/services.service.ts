import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Service, FarmStats, EMPTY_FARM_STATS } from '@atome/shared'
import { McpService } from '../mcp/mcp.service'

@Injectable()
export class ServicesService implements OnModuleInit {
  private readonly logger = new Logger(ServicesService.name)
  private services: Service[]   = []
  private farmStats: FarmStats  = { ...EMPTY_FARM_STATS }

  constructor(private readonly mcp: McpService) {}

  async onModuleInit() {
    await this.sync()
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async sync() {
    this.logger.log('Syncing services and farm stats...')
    const [services, farmStats] = await Promise.all([
      this.mcp.fetchAllServices(),
      this.mcp.fetchFarmStats(),
    ])
    this.services  = services
    this.farmStats = farmStats
    this.logger.log(`Loaded ${this.services.length} services`)
  }

  getAll(): Service[] {
    return this.services
  }

  getById(id: string): Service | undefined {
    return this.services.find((s) => s.id === id)
  }

  getFarmStats(): FarmStats {
    return this.farmStats
  }
}
