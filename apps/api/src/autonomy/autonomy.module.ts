import { Module } from "@nestjs/common";
import { AutonomyController } from "./autonomy.controller";
import { AutonomyService } from "./autonomy.service";

@Module({
  providers: [AutonomyService],
  controllers: [AutonomyController],
  exports: [AutonomyService],
})
export class AutonomyModule {}
