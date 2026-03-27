import { Module } from '@nestjs/common'
import { ServicesController } from './services.controller'
import { ServicesService } from './services.service'
import { McpModule } from '../mcp/mcp.module'

@Module({
  imports: [McpModule],
  controllers: [ServicesController],
  providers: [ServicesService],
})
export class ServicesModule {}
