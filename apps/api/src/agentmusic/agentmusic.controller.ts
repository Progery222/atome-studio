import { Body, Controller, Get, HttpException, Param, Post, Req } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import type { Request } from "express";

const AGENTMUSIC_URL = process.env.AGENTMUSIC_URL ?? "http://localhost:8080";

// Пробрасывает detail/сообщение и статус от agentMUSIC наверх, вместо немого "Internal server error".
async function proxy(path: string, init?: RequestInit, timeoutMs = 30000) {
  let res: Response;
  try {
    res = await fetch(`${AGENTMUSIC_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "upstream unreachable";
    throw new HttpException({ detail: `agentMUSIC: ${msg}` }, 504);
  }
  const data = await res.json().catch(() => ({ detail: `agentMUSIC: HTTP ${res.status}` }));
  if (!res.ok) {
    throw new HttpException(data, res.status);
  }
  return data;
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

  @Get("jobs")
  async getJobs() {
    return proxy("/api/jobs");
  }

  @Get("jobs/:id")
  async getJob(@Param("id") id: string) {
    return proxy(`/api/jobs/${id}`);
  }

  @Get("videos")
  async getVideos() {
    return proxy("/api/videos");
  }

  @Post("generate")
  async generate(@Body() body: Record<string, unknown>) {
    return proxy("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  }

  @Post("spotify")
  async spotify(@Body() body: { url: string }) {
    // async: мгновенно создаёт job, скачивание идёт в фоне. Клиент опрашивает /spotify/job/:id.
    return proxy("/api/tracks/spotify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, 600000);
  }

  @Get("spotify/job/:id")
  async spotifyJobStatus(@Param("id") id: string) {
    return proxy(`/api/tracks/spotify/job/${id}`);
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
    // Whisper-транскрипция + извлечение припева — долго (2-5 мин)
    return proxy(`/api/tracks/${id}/process`, { method: "POST" }, 300000);
  }

  @Get("tracks/minio")
  async getMinioTracks() {
    return proxy("/api/tracks/minio");
  }

  @Post("tracks/minio/import")
  async importMinioTrack(@Body() body: { key: string }) {
    // Longer timeout — transcription + chorus extraction can take 2+ minutes
    const res = await fetch(`${AGENTMUSIC_URL}/api/tracks/minio/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300000),
    });
    return res.json();
  }

  @Post("tracks/minio/import-batch")
  async importMinioBatch(@Body() body: { keys: string[] }) {
    const res = await fetch(`${AGENTMUSIC_URL}/api/tracks/minio/import-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(600000),
    });
    return res.json();
  }
}
