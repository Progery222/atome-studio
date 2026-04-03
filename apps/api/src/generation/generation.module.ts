import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { GenerationController } from "./generation.controller";
import { GenerationService } from "./generation.service";

@Module({
  imports: [EventsModule],
  providers: [GenerationService],
  controllers: [GenerationController],
})
export class GenerationModule {}
