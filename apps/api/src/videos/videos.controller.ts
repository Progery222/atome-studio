import { Controller, Get, Param, Res, Header } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../auth/public.decorator";
import { VideosService } from "./videos.service";

@Controller()
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Get("videos")
  getVideos() {
    return this.videos.getVideos();
  }

  @Public()
  @Get("videos/proxy/:key(*)")
  @Header("Cache-Control", "public, max-age=86400")
  async proxyVideo(@Param("key") key: string, @Res() res: Response) {
    const stream = await this.videos.streamVideo(key);
    if (!stream) {
      res.status(404).json({ error: "Video not found" });
      return;
    }
    res.setHeader("Content-Type", "video/mp4");
    if (stream.size) res.setHeader("Content-Length", stream.size.toString());
    res.setHeader("Accept-Ranges", "bytes");
    stream.body.pipe(res);
  }
}
