import { Injectable, Logger } from '@nestjs/common'
import { GenerationJob } from '@atome/shared'

interface GenerateDto {
  service: 'sportzavod' | 'contentzavod'
  account_ids: string[]
  videos_per_account: number
  topic?: string
}

@Injectable()
export class GenerationService {
  private readonly logger         = new Logger(GenerationService.name)
  private readonly sportzavodUrl  = process.env.SPORTZAVOD_URL  ?? 'http://localhost:8000'
  private readonly contentzavodUrl = process.env.CONTENTZAVOD_URL ?? 'http://localhost:8002'

  /** Maps job_id → service name for later routing */
  private readonly jobServiceMap = new Map<string, 'sportzavod' | 'contentzavod'>()

  private baseUrlFor(service: 'sportzavod' | 'contentzavod'): string {
    return service === 'sportzavod' ? this.sportzavodUrl : this.contentzavodUrl
  }

  private async get<T>(url: string): Promise<T | null> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return null
      return res.json() as Promise<T>
    } catch {
      this.logger.warn(`Unavailable: GET ${url}`)
      return null
    }
  }

  private async post<T>(url: string, body: unknown): Promise<T | null> {
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(5000),
      })
      if (!res.ok) return null
      return res.json() as Promise<T>
    } catch {
      this.logger.warn(`Unavailable: POST ${url}`)
      return null
    }
  }

  async generate(dto: GenerateDto): Promise<GenerationJob | null> {
    const base = this.baseUrlFor(dto.service)
    const payload = dto.service === 'sportzavod'
      ? { account_ids: dto.account_ids, videos_per_account: dto.videos_per_account, topic: dto.topic }
      : { account_id: dto.account_ids[0], topic: dto.topic, videos_per_account: dto.videos_per_account }

    const raw = await this.post<Record<string, unknown>>(`${base}/api/generate`, payload)
    if (!raw) return null

    const job = this.normalizeJob(raw, dto.service)
    this.jobServiceMap.set(job.job_id, dto.service)
    return job
  }

  async getJob(id: string): Promise<GenerationJob | null> {
    const service = this.jobServiceMap.get(id)
    if (!service) {
      // Try both services if mapping is unknown (e.g. after restart)
      for (const svc of ['sportzavod', 'contentzavod'] as const) {
        const raw = await this.get<Record<string, unknown>>(`${this.baseUrlFor(svc)}/api/jobs/${id}`)
        if (raw) {
          this.jobServiceMap.set(id, svc)
          return this.normalizeJob(raw, svc)
        }
      }
      return null
    }

    const base = this.baseUrlFor(service)
    const raw  = await this.get<Record<string, unknown>>(`${base}/api/jobs/${id}`)
    return raw ? this.normalizeJob(raw, service) : null
  }

  async getAllJobs(): Promise<GenerationJob[]> {
    const [szJobs, czJobs] = await Promise.allSettled([
      this.get<Record<string, unknown>[]>(`${this.sportzavodUrl}/api/jobs`),
      this.get<Record<string, unknown>[]>(`${this.contentzavodUrl}/api/jobs`),
    ])

    const jobs: GenerationJob[] = []

    if (szJobs.status === 'fulfilled' && szJobs.value) {
      for (const raw of szJobs.value) {
        const job = this.normalizeJob(raw, 'sportzavod')
        this.jobServiceMap.set(job.job_id, 'sportzavod')
        jobs.push(job)
      }
    }

    if (czJobs.status === 'fulfilled' && czJobs.value) {
      for (const raw of czJobs.value) {
        const job = this.normalizeJob(raw, 'contentzavod')
        this.jobServiceMap.set(job.job_id, 'contentzavod')
        jobs.push(job)
      }
    }

    return jobs
  }

  async stopJob(id: string): Promise<{ ok: boolean }> {
    const service = this.jobServiceMap.get(id)
    if (!service) return { ok: false }

    const base   = this.baseUrlFor(service)
    const result = await this.post(`${base}/api/jobs/${id}/stop`, {})
    return { ok: result !== null }
  }

  async generateAuto(dto: { account_ids?: string[]; videos_per_account?: number }): Promise<GenerationJob | null> {
    const payload = {
      account_ids: dto.account_ids ?? [],
      videos_per_account: dto.videos_per_account ?? 1,
    }
    const raw = await this.post<Record<string, unknown>>(`${this.sportzavodUrl}/api/generate/auto`, payload)
    if (!raw) return null
    const job = this.normalizeJob(raw, 'sportzavod')
    this.jobServiceMap.set(job.job_id, 'sportzavod')
    return job
  }

  async stopAllJobs(): Promise<{ stopped_count: number }> {
    const result = await this.post<{ stopped_count?: number }>(`${this.sportzavodUrl}/api/jobs/stop-all`, {})
    return { stopped_count: result?.stopped_count ?? 0 }
  }

  private normalizeJob(
    raw: Record<string, unknown>,
    service: 'sportzavod' | 'contentzavod',
  ): GenerationJob {
    return {
      job_id:             String(raw.job_id ?? raw.id ?? crypto.randomUUID()),
      service,
      account_ids:        Array.isArray(raw.account_ids) ? raw.account_ids as string[] : [],
      topic:              raw.topic != null ? String(raw.topic) : undefined,
      videos_per_account: typeof raw.videos_per_account === 'number' ? raw.videos_per_account : 1,
      status:             this.normalizeStatus(raw.status),
      is_auto:            raw.is_auto === true,
      progress:           typeof raw.progress === 'number' ? raw.progress : 0,
      total:              typeof raw.total === 'number' ? raw.total : 0,
      errors_count:       typeof raw.errors_count === 'number' ? raw.errors_count : (Array.isArray(raw.errors) ? raw.errors.length : 0),
      created_at:         raw.created_at != null ? String(raw.created_at) : new Date().toISOString(),
      results:            Array.isArray(raw.results)
        ? (raw.results as Array<{ account_id: string; video_url: string }>)
        : undefined,
    }
  }

  private normalizeStatus(s: unknown): GenerationJob['status'] {
    if (s === 'running') return 'running'
    if (s === 'stopping') return 'stopping'
    if (s === 'stopped') return 'stopped'
    if (s === 'done' || s === 'completed' || s === 'success') return 'done'
    return 'error'
  }
}
