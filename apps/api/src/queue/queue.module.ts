import { Module } from "@nestjs/common";
import { QueueController } from "./queue.controller";
import { QueueService } from "./queue.service";

@Module({
  providers: [QueueService],
  controllers: [QueueController],
})
export class QueueModule {}
