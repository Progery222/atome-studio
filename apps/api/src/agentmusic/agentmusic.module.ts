import { Module } from "@nestjs/common";
import { AgentMusicController } from "./agentmusic.controller";

@Module({
  controllers: [AgentMusicController],
})
export class AgentMusicModule {}
