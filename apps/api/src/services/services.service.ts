import { EMPTY_FARM_STATS, type FarmStats, type HeroKPI, type Service } from "@atome/shared";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { McpService } from "../mcp/mcp.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ServicesService implements OnModuleInit {
  private readonly logger = new Logger(ServicesService.name);
  private services: Service[] = [];
  private farmStats: FarmStats = { ...EMPTY_FARM_STATS };
  private videosToday = 0;
  private costPerVideo = 0;

  constructor(
    private readonly mcp: McpService,
    private readonly prisma: PrismaService
  ) {}

  async onModuleInit() {
    await this.sync();
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async sync() {
    try {
      this.logger.log("Syncing services and farm stats...");
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [services, farmStats, todayRow, costRow] = await Promise.all([
        this.mcp.fetchAllServices(),
        this.mcp.fetchFarmStats(),
        this.prisma.generationJobLog.aggregate({
          where: { status: "done", createdAt: { gte: todayStart } },
          _sum: { videosCount: true },
        }),
        this.prisma.generationJobLog.aggregate({
          where: { status: "done", costUsd: { gt: 0 } },
          _sum: { costUsd: true, videosCount: true },
        }),
      ]);

      this.services = services;
      this.farmStats = farmStats;
      this.videosToday = todayRow._sum.videosCount ?? 0;
      const totalCost = costRow._sum.costUsd ?? 0;
      const totalVideos = costRow._sum.videosCount ?? 0;
      this.costPerVideo = totalVideos > 0 ? totalCost / totalVideos : 0;
      this.logger.log(
        `Loaded ${this.services.length} services, videos today: ${this.videosToday}, avg cost/video: $${this.costPerVideo.toFixed(4)}`
      );
    } catch (e) {
      this.logger.error(`Sync failed: ${e}`);
    }
  }

  getAll(): Service[] {
    return this.services;
  }

  getById(id: string): Service | undefined {
    return this.services.find((s) => s.id === id);
  }

  getFarmStats(): FarmStats {
    return this.farmStats;
  }

  getHeroKPIs(): HeroKPI {
    const s = this.farmStats;
    const uptime = s.phones_total > 0 ? Math.round((s.phones_online / s.phones_total) * 100) : 0;
    const videosToday = this.videosToday > 0 ? this.videosToday : s.posts_today;
    return {
      videos_today: videosToday,
      cost_per_video: this.costPerVideo,
      publish_rate: s.phones_total > 0 ? s.phones_online / s.phones_total : 0,
      active_accounts: s.accounts_active,
      uptime_percent: uptime,
      trends: {
        videos_today: 0,
        cost_per_video: 0,
        publish_rate: 0,
        active_accounts: 0,
        uptime_percent: 0,
      },
    };
  }
}
