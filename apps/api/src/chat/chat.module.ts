import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { ChatGateway } from "./chat.gateway";
import { ToolExecutor } from "./tool-executor";

@Module({
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, ToolExecutor],
})
export class ChatModule {}
