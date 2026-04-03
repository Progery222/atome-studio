import { Controller, Get } from "@nestjs/common";
import { VideosService } from "./videos.service";

@Controller()
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Get("videos")
  getVideos() {
    return this.videos.getVideos();
  }
}
