import { Module } from "@nestjs/common";
import { VideosController } from "./videos.controller";
import { VideosService } from "./videos.service";

@Module({
  providers: [VideosService],
  controllers: [VideosController],
})
export class VideosModule {}
