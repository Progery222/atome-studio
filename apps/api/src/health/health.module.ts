import { Module } from "@nestjs/common";
import { ServicesModule } from "../services/services.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [ServicesModule],
  controllers: [HealthController],
})
export class HealthModule {}
