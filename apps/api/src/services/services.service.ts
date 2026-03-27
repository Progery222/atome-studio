import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Service } from '@atome/shared'
import { McpService } from '../mcp/mcp.service'

@Injectable()
export class ServicesService implements OnModuleInit {
  private readonly logger = new Logger(ServicesService.name)
  private services: Service[] = []

  constructor(private readonly mcp: McpService) {}

  async onModuleInit() {
    await this.sync()
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async sync() {
    this.logger.log('Syncing services from MCP adapters...')
    this.services = await this.mcp.fetchAllServices()
    this.logger.log(`Loaded ${this.services.length} services`)
  }

  getAll(): Service[] {
    return this.services
  }

  getById(id: string): Service | undefined {
    return this.services.find((s) => s.id === id)
  }

  getStats() {
    const total    = this.services.length
    const online   = this.services.filter((s) => s.status === 'online').length
    const platforms = [...new Set(this.services.map((s) => s.platform))].length
    const uptime   = total > 0 ? Math.round((online / total) * 1000) / 10 : 100
    return { total, online, platforms, uptime }
  }
}
