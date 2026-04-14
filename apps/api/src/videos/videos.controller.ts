import { Controller, Get, Param, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { Public } from "../auth/public.decorator";
import { VideosService } from "./videos.service";

@Controller()
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Get("videos")
  getVideos() {
    return this.videos.getVideos();
  }

  /**
   * Stream video from MinIO through the backend.
   * Public (no JWT) because <video> tags cannot send auth headers.
   * Supports Range requests for seeking.
   */
  @Public()
  @Get("videos/proxy/:key(*)")
  async proxyVideo(
    @Param("key") key: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const url = this.videos.getVideoUrl(key);

    // Forward Range header for seeking support
    const headers: Record<string, string> = {};
    if (req.headers.range) {
      headers["Range"] = req.headers.range;
    }

    try {
      const upstream = await fetch(url, { headers });

      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).json({ error: "Video not found" });
        return;
      }

      // Forward status (200 or 206 Partial Content)
      res.status(upstream.status);

      // Forward essential headers
      const fwd = [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "etag",
        "last-modified",
      ];
      for (const h of fwd) {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      }
      res.setHeader("Cache-Control", "public, max-age=86400");

      // Pipe body to response
      if (upstream.body) {
        const { Readable } = await import("node:stream");
        const nodeStream = Readable.fromWeb(upstream.body as any);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (e) {
      res.status(502).json({ error: "Upstream error" });
    }
  }
}
