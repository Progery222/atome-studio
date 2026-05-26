import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { VideosModule } from "../videos/videos.module";
import { GenerationController } from "./generation.controller";
import { GenerationService } from "./generation.service";
import { JobEventsService } from "./job-events.service";

@Module({
  imports: [EventsModule, VideosModule],
  providers: [GenerationService, JobEventsService],
  controllers: [GenerationController],
})
export class GenerationModule {}
