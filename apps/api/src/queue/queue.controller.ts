import { Controller, Get } from "@nestjs/common";
import type { QueueService } from "./queue.service";

@Controller()
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  @Get("queue")
  getTasks() {
    return this.queue.getTasks();
  }
}
