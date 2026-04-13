import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { ClientsModule } from "./clients/clients.module";
import { EventsModule } from "./events/events.module";
import { FarmModule } from "./farm/farm.module";
import { GenerationModule } from "./generation/generation.module";
import { McpModule } from "./mcp/mcp.module";
import { MetricsModule } from "./metrics/metrics.module";
import { PrismaModule } from "./prisma/prisma.module";
import { QueueModule } from "./queue/queue.module";
import { ServicesModule } from "./services/services.module";
import { StreamCutModule } from "./streamcut/streamcut.module";
import { VideosModule } from "./videos/videos.module";
import { AgentMusicModule } from "./agentmusic/agentmusic.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
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
    ClientsModule,
    MetricsModule,
    AgentMusicModule,
  ],
  providers: [
    // Apply JWT guard to every route globally; use @Public() to opt out
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
