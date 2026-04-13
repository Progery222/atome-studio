import { Body, Controller, Get, NotFoundException, Param, Post } from "@nestjs/common";
import { GenerationService } from "./generation.service";

interface GenerateDto {
  service: "sportzavod" | "contentzavod" | "agentmusic";
  account_ids: string[];
  videos_per_account: number;
  topic?: string;
}

@Controller()
export class GenerationController {
  constructor(private readonly generation: GenerationService) {}

  @Post("generate/auto")
  async generateAuto(@Body() body: { account_ids?: string[]; videos_per_account?: number }) {
    const job = await this.generation.generateAuto(body);
    if (!job) throw new NotFoundException("SportZavod unavailable");
    return job;
  }

  @Post("generate")
  async generate(@Body() body: GenerateDto) {
    const job = await this.generation.generate(body);
    if (!job) throw new NotFoundException("Generation service unavailable");
    return job;
  }

  @Get("jobs")
  getJobs() {
    return this.generation.getAllJobs();
  }

  @Post("jobs/stop-all")
  stopAllJobs() {
    return this.generation.stopAllJobs();
  }

  @Get("jobs/stats")
  getJobStats() {
    return this.generation.getStats();
  }

  @Get("jobs/cost-stats")
  getCostStats() {
    return this.generation.getCostStats();
  }

  @Get("jobs/:id/events")
  getJobEvents(@Param("id") id: string) {
    return this.generation.getJobEvents(id);
  }

  @Get("jobs/:id")
  async getJob(@Param("id") id: string) {
    const job = await this.generation.getJob(id);
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  @Post("jobs/:id/stop")
  stopJob(@Param("id") id: string) {
    return this.generation.stopJob(id);
  }
}
