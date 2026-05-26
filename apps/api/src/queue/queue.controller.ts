import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { QueueService } from "./queue.service";

@Controller()
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  @Get("queue")
  getTasks() {
    return this.queue.getTasks();
  }

  @Post("tasks")
  createTask(
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.queue.createTask(body, idempotencyKey);
  }
}
