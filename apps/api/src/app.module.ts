import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { ServicesModule } from './services/services.module'
import { McpModule } from './mcp/mcp.module'
import { AuthModule } from './auth/auth.module'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    McpModule,
    ServicesModule,
  ],
})
export class AppModule {}
