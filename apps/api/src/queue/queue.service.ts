import { Injectable, Logger } from '@nestjs/common'
import { QueueTask } from '@atome/shared'

@Injectable()
export class QueueService {
  private readonly logger  = new Logger(QueueService.name)
  private readonly baseUrl = process.env.ORCHESTRATOR_URL ?? 'http://localhost:8001'

  private async get<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return null
      return res.json() as Promise<T>
    } catch {
      this.logger.warn(`Orchestrator unavailable: GET ${path}`)
      return null
    }
  }

  async getTasks(): Promise<QueueTask[]> {
    // Try /api/tasks first, fall back to /api/queue
    const tasks = await this.get<QueueTask[]>('/api/tasks')
    if (tasks !== null) return tasks

    const queue = await this.get<QueueTask[]>('/api/queue')
    return queue ?? []
  }
}
