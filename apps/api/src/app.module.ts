import { Module }  from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { ServicesModule }    from './services/services.module'
import { McpModule }         from './mcp/mcp.module'
import { AuthModule }        from './auth/auth.module'
import { FarmModule }        from './farm/farm.module'
import { GenerationModule }  from './generation/generation.module'
import { QueueModule }       from './queue/queue.module'
import { EventsModule }      from './events/events.module'
import { VideosModule }      from './videos/videos.module'
import { ClientsModule }     from './clients/clients.module'
import { JwtAuthGuard }      from './auth/jwt-auth.guard'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    McpModule,
    ServicesModule,
    FarmModule,
    GenerationModule,
    QueueModule,
    EventsModule,
    VideosModule,
    ClientsModule,
  ],
  providers: [
    // Apply JWT guard to every route globally; use @Public() to opt out
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
