import { Module } from '@nestjs/common'
import { SportZavodAdapter } from './sportzavod/sportzavod.adapter'
import { ContentZavodAdapter } from './contentzavod/contentzavod.adapter'
import { FarmAdapter } from './farm/farm.adapter'
import { McpService } from './mcp.service'

@Module({
  providers: [SportZavodAdapter, ContentZavodAdapter, FarmAdapter, McpService],
  exports: [McpService],
})
export class McpModule {}
