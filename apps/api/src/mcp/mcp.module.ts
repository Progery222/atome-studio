import { Module } from "@nestjs/common";
import { ContentZavodAdapter } from "./contentzavod/contentzavod.adapter";
import { FarmAdapter } from "./farm/farm.adapter";
import { McpService } from "./mcp.service";
import { SportZavodAdapter } from "./sportzavod/sportzavod.adapter";
import { StreamCutAdapter } from "./streamcut/streamcut.adapter";

@Module({
  providers: [SportZavodAdapter, ContentZavodAdapter, StreamCutAdapter, FarmAdapter, McpService],
  exports: [McpService],
})
export class McpModule {}
