import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import type { Request } from "express";

const AGENTMUSIC_URL = process.env.AGENTMUSIC_URL ?? "http://localhost:8080";

async function proxy(path: string, init?: RequestInit) {
  const res = await fetch(`${AGENTMUSIC_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(30000),
  });
  return res.json();
}

@Public()
@Controller("agentmusic")
export class AgentMusicController {
  @Get("tracks")
  async getTracks() {
    return proxy("/api/tracks");
  }

  @Get("choruses")
  async getChoruses() {
    return proxy("/api/choruses");
  }

  @Post("spotify")
  async spotify(@Body() body: { url: string }) {
    return proxy("/api/tracks/spotify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  @Post("upload")
  async upload(@Req() req: Request) {
    // Forward the raw multipart request to agentMUSIC
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const bodyBuffer = Buffer.concat(chunks);
    const contentType = req.headers["content-type"] || "application/octet-stream";

    const res = await fetch(`${AGENTMUSIC_URL}/api/tracks/upload`, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: bodyBuffer,
      signal: AbortSignal.timeout(60000),
    });
    return res.json();
  }

  @Post("tracks/:id/process")
  async processTrack(@Param("id") id: string) {
    return proxy(`/api/tracks/${id}/process`, { method: "POST" });
  }
}
