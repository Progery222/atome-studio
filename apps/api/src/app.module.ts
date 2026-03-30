import { Module } from '@nestjs/common'
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
})
export class AppModule {}
