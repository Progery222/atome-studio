import { Readable } from "node:stream";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { StreamCutService } from "./streamcut.service";

@Controller("streamcut")
export class StreamCutController {
  constructor(private readonly streamcut: StreamCutService) {}

  @Get("video-info")
  async getVideoInfo(@Query("url") url: string) {
    if (!url) throw new HttpException("url query parameter is required", 400);
    const info = await this.streamcut.getVideoInfo(url);
    if (!info) throw new HttpException("Failed to fetch video info", 502);
    return info;
  }

  @Post("jobs")
  async createJob(@Body() body: Record<string, unknown>) {
    const job = await this.streamcut.createJob(body as never);
    if (!job) throw new HttpException("Failed to create job", 502);
    return job;
  }

  @Get("jobs")
  async listJobs() {
    return this.streamcut.listJobs();
  }

  @Get("jobs/:id")
  async getJob(@Param("id") id: string) {
    const job = await this.streamcut.getJob(id);
    if (!job) throw new HttpException("Job not found", 404);
    return job;
  }

  @Delete("jobs/:id")
  async deleteJob(@Param("id") id: string) {
    const ok = await this.streamcut.deleteJob(id);
    if (!ok) throw new HttpException("Failed to delete job", 502);
    return { message: "deleted" };
  }

  @Get("footage-categories")
  async getFootageCategories() {
    return { categories: await this.streamcut.getFootageCategories() };
  }

  @Get("storage/:jobId/:filename")
  async proxyFile(
    @Param("jobId") jobId: string,
    @Param("filename") filename: string,
    @Res() res: Response
  ) {
    const result = await this.streamcut.proxyFile(`${jobId}/${filename}`);
    if (!result) throw new HttpException("File not found", 404);
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    const reader = (result.stream as any).getReader();
    const nodeStream = new Readable({
      async read() {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
          return;
        }
        this.push(Buffer.from(value));
      },
    });
    nodeStream.pipe(res);
  }
}
