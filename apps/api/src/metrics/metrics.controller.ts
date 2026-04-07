import { Controller, Get, Query } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { MetricsService } from "./metrics.service";

@Public()
@Controller("metrics")
export class MetricsController {
  constructor(private readonly svc: MetricsService) {}

  @Get("history")
  async getHistory(@Query("period") period?: string, @Query("resolution") resolution?: string) {
    return this.svc.getHistory(period, resolution);
  }
}
