import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Public } from "../auth/public.decorator";
import type { Request, Response } from "express";

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
  @UseInterceptors(FileInterceptor("file"))
  async upload(@UploadedFile() file: Express.Multer.File) {
    const formData = new FormData();
    const blob = new Blob([file.buffer], { type: file.mimetype });
    formData.append("file", blob, file.originalname);

    const res = await fetch(`${AGENTMUSIC_URL}/api/tracks/upload`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(60000),
    });
    return res.json();
  }
}
