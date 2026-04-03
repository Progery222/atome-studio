import { Controller, Get, Query } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import type { MetricsService } from "./metrics.service";

@Public()
@Controller("metrics")
export class MetricsController {
  constructor(private readonly svc: MetricsService) {}

  @Get("history")
  getHistory(@Query("period") period?: string, @Query("resolution") resolution?: string) {
    return this.svc.getHistory(period, resolution);
  }
}
