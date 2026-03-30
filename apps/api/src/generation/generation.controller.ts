import { Controller, Get, Post, Param, Body, NotFoundException } from '@nestjs/common'
import { GenerationService } from './generation.service'

interface GenerateDto {
  service: 'sportzavod' | 'contentzavod'
  account_ids: string[]
  videos_per_account: number
  topic?: string
}

@Controller()
export class GenerationController {
  constructor(private readonly generation: GenerationService) {}

  @Post('generate')
  async generate(@Body() body: GenerateDto) {
    const job = await this.generation.generate(body)
    if (!job) throw new NotFoundException('Generation service unavailable')
    return job
  }

  @Get('jobs')
  getJobs() {
    return this.generation.getAllJobs()
  }

  @Get('jobs/:id')
  async getJob(@Param('id') id: string) {
    const job = await this.generation.getJob(id)
    if (!job) throw new NotFoundException(`Job ${id} not found`)
    return job
  }

  @Post('jobs/:id/stop')
  stopJob(@Param('id') id: string) {
    return this.generation.stopJob(id)
  }
}
