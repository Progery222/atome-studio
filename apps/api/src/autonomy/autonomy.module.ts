import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { AutonomyController } from "./autonomy.controller";
import { AutonomyService } from "./autonomy.service";

@Module({
  imports: [EventsModule],
  providers: [AutonomyService],
  controllers: [AutonomyController],
  exports: [AutonomyService],
})
export class AutonomyModule {}
