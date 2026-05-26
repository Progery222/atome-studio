import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AgentMusicModule } from "./agentmusic/agentmusic.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { AutonomyModule } from "./autonomy/autonomy.module";
import { ClientsModule } from "./clients/clients.module";
import { ContentRoutingModule } from "./content-routing/content-routing.module";
import { EventsModule } from "./events/events.module";
import { FarmModule } from "./farm/farm.module";
import { GenerationModule } from "./generation/generation.module";
import { HealthModule } from "./health/health.module";
import { McpModule } from "./mcp/mcp.module";
import { MetricsModule } from "./metrics/metrics.module";
import { PrismaModule } from "./prisma/prisma.module";
import { QueueModule } from "./queue/queue.module";
import { ServicesModule } from "./services/services.module";
import { SharedModule } from "./shared/shared.module";
import { StreamCutModule } from "./streamcut/streamcut.module";
import { VideosModule } from "./videos/videos.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]),
    SharedModule,
    PrismaModule,
    AuthModule,
    McpModule,
    ServicesModule,
    FarmModule,
    GenerationModule,
    QueueModule,
    EventsModule,
    VideosModule,
    StreamCutModule,
    ContentRoutingModule,
    ClientsModule,
    MetricsModule,
    AgentMusicModule,
    AutonomyModule,
    HealthModule,
    AuditModule,
  ],
  providers: [
    // Apply JWT guard to every route globally; use @Public() to opt out
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global rate limiter; per-route override via @Throttle()
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
