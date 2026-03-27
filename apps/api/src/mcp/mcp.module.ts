import { Module } from '@nestjs/common'
import { CloudflareAdapter } from './cloudflare/cloudflare.adapter'
import { PosthogAdapter } from './posthog/posthog.adapter'
import { PostmanAdapter } from './postman/postman.adapter'
import { McpService } from './mcp.service'

@Module({
  providers: [CloudflareAdapter, PosthogAdapter, PostmanAdapter, McpService],
  exports: [McpService],
})
export class McpModule {}
