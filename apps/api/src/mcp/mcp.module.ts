import { Module } from "@nestjs/common";
import { ContentZavodAdapter } from "./contentzavod/contentzavod.adapter";
import { FarmAdapter } from "./farm/farm.adapter";
import { McpService } from "./mcp.service";
import { SportZavodAdapter } from "./sportzavod/sportzavod.adapter";

@Module({
  providers: [SportZavodAdapter, ContentZavodAdapter, FarmAdapter, McpService],
  exports: [McpService],
})
export class McpModule {}
