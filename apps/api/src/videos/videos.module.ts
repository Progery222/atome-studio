import { Module } from "@nestjs/common";
import { StreamCutModule } from "../streamcut/streamcut.module";
import { VideosController } from "./videos.controller";
import { VideosService } from "./videos.service";

@Module({
  imports: [StreamCutModule],
  providers: [VideosService],
  controllers: [VideosController],
})
export class VideosModule {}
