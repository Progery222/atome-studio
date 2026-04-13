import { Module } from "@nestjs/common";
import { AgentMusicAdapter } from "./agentmusic/agentmusic.adapter";
import { ContentZavodAdapter } from "./contentzavod/contentzavod.adapter";
import { FarmAdapter } from "./farm/farm.adapter";
import { McpService } from "./mcp.service";
import { SportZavodAdapter } from "./sportzavod/sportzavod.adapter";
import { StreamCutAdapter } from "./streamcut/streamcut.adapter";

@Module({
  providers: [SportZavodAdapter, ContentZavodAdapter, StreamCutAdapter, FarmAdapter, AgentMusicAdapter, McpService],
  exports: [McpService],
})
export class McpModule {}
