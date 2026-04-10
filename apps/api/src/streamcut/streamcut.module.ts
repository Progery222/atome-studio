import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { StreamCutController } from "./streamcut.controller";
import { StreamCutService } from "./streamcut.service";

@Module({
  imports: [EventsModule],
  providers: [StreamCutService],
  controllers: [StreamCutController],
})
export class StreamCutModule {}
