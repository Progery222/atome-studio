import type { GenerationJob, GenerationStats } from "@atome/shared";
import { Injectable, Logger } from "@nestjs/common";
import { EventsGateway } from "../events/events.gateway";
import { PrismaService } from "../prisma/prisma.service";

interface GenerateDto {
  service: "sportzavod" | "contentzavod";
  account_ids: string[];
  videos_per_account: number;
  topic?: string;
}

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);
  private readonly sportzavodUrl = process.env.SPORTZAVOD_URL ?? "http://localhost:8000";
  private readonly contentzavodUrl = process.env.CONTENTZAVOD_URL ?? "http://localhost:8002";

  constructor(
    private readonly events: EventsGateway,
    private readonly prisma: PrismaService
  ) {}

  /** Maps job_id → service name for later routing */
  private readonly jobServiceMap = new Map<string, "sportzavod" | "contentzavod">();

  /** Maps job_id → start timestamp (ms) for accurate duration tracking */
  private readonly jobStartTimes = new Map<string, number>();

  private baseUrlFor(service: "sportzavod" | "contentzavod"): string {
    return service === "sportzavod" ? this.sportzavodUrl : this.contentzavodUrl;
  }

  private async get<T>(url: string): Promise<T | null> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      return res.json() as Promise<T>;
    } catch {
      this.logger.warn(`Unavailable: GET ${url}`);
      return null;
    }
  }

  private async post<T>(url: string, body: unknown): Promise<T | null> {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      return res.json() as Promise<T>;
    } catch {
      this.logger.warn(`Unavailable: POST ${url}`);
      return null;
    }
  }

  async generate(dto: GenerateDto): Promise<GenerationJob | null> {
    const base = this.baseUrlFor(dto.service);
    const payload =
      dto.service === "sportzavod"
        ? {
            account_ids: dto.account_ids,
            videos_per_account: dto.videos_per_account,
            topic: dto.topic,
          }
        : {
            account_id: dto.account_ids[0],
            topic: dto.topic,
            videos_per_account: dto.videos_per_account,
          };

    const raw = await this.post<Record<string, unknown>>(`${base}/api/generate`, payload);
    if (!raw) return null;

    const job = this.normalizeJob(raw, dto.service);
    this.jobServiceMap.set(job.job_id, dto.service);
    this.jobStartTimes.set(job.job_id, Date.now());

    this.events.emit({
      event: "job_started",
      phone_id: "",
      details: {
        job_id: job.job_id,
        service: job.service,
        account_ids: job.account_ids,
        videos_per_account: job.videos_per_account,
        topic: job.topic,
        total: job.total,
      },
      timestamp: new Date().toISOString(),
    });

    this.pollJobUntilDone(job.job_id);
    return job;
  }

  async getJob(id: string): Promise<GenerationJob | null> {
    const service = this.jobServiceMap.get(id);
    if (!service) {
      // Try both services if mapping is unknown (e.g. after restart)
      for (const svc of ["sportzavod", "contentzavod"] as const) {
        const found = await this.getJobFromService(id, svc);
        if (found) {
          this.jobServiceMap.set(id, svc);
          return found;
        }
      }
      return null;
    }

    return this.getJobFromService(id, service);
  }

  /** Fetch single job — falls back to list scan if service has no GET /jobs/:id */
  private async getJobFromService(
    id: string,
    service: "sportzavod" | "contentzavod"
  ): Promise<GenerationJob | null> {
    const base = this.baseUrlFor(service);
    const raw = await this.get<Record<string, unknown>>(`${base}/api/jobs/${id}`);
    if (raw) return this.normalizeJob(raw, service);

    // SportZavod has no GET /api/jobs/:id — scan the list instead
    const list = await this.get<Record<string, unknown>[]>(`${base}/api/jobs`);
    if (!list) return null;
    const found = list.find((j) => String(j.job_id ?? j.id) === id);
    return found ? this.normalizeJob(found, service) : null;
  }

  async getAllJobs(): Promise<GenerationJob[]> {
    const [szJobs, czJobs] = await Promise.allSettled([
      this.get<Record<string, unknown>[]>(`${this.sportzavodUrl}/api/jobs`),
      this.get<Record<string, unknown>[]>(`${this.contentzavodUrl}/api/jobs`),
    ]);

    const jobs: GenerationJob[] = [];

    if (szJobs.status === "fulfilled" && szJobs.value) {
      for (const raw of szJobs.value) {
        const job = this.normalizeJob(raw, "sportzavod");
        this.jobServiceMap.set(job.job_id, "sportzavod");
        jobs.push(job);
      }
    }

    if (czJobs.status === "fulfilled" && czJobs.value) {
      for (const raw of czJobs.value) {
        const job = this.normalizeJob(raw, "contentzavod");
        this.jobServiceMap.set(job.job_id, "contentzavod");
        jobs.push(job);
      }
    }

    return jobs;
  }

  async stopJob(id: string): Promise<{ ok: boolean }> {
    let service = this.jobServiceMap.get(id);
    if (!service) {
      // Map may be empty after API restart — resolve via getJob lookup
      await this.getJob(id);
      service = this.jobServiceMap.get(id);
      if (!service) return { ok: false };
    }

    const base = this.baseUrlFor(service);
    const result = await this.post(`${base}/api/jobs/${id}/stop`, {});
    if (result !== null) {
      this.events.emit({
        event: "job_stopped",
        phone_id: "",
        details: { job_id: id, service },
        timestamp: new Date().toISOString(),
      });
    }
    return { ok: result !== null };
  }

  async generateAuto(dto: {
    account_ids?: string[];
    videos_per_account?: number;
  }): Promise<GenerationJob | null> {
    const payload = {
      account_ids: dto.account_ids ?? [],
      videos_per_account: dto.videos_per_account ?? 1,
    };
    const raw = await this.post<Record<string, unknown>>(
      `${this.sportzavodUrl}/api/generate/auto`,
      payload
    );
    if (!raw) return null;
    const job = this.normalizeJob(raw, "sportzavod");
    this.jobServiceMap.set(job.job_id, "sportzavod");
    this.jobStartTimes.set(job.job_id, Date.now());

    this.events.emit({
      event: "job_started",
      phone_id: "",
      details: {
        job_id: job.job_id,
        service: "sportzavod",
        is_auto: true,
        total: job.total,
      },
      timestamp: new Date().toISOString(),
    });

    this.pollJobUntilDone(job.job_id);
    return job;
  }

  async stopAllJobs(): Promise<{ stopped_count: number }> {
    const result = await this.post<{ stopped_count?: number }>(
      `${this.sportzavodUrl}/api/jobs/stop-all`,
      {}
    );
    return { stopped_count: result?.stopped_count ?? 0 };
  }

  /** Poll a running job every 8 s, emit job_complete or error when it finishes */
  private pollJobUntilDone(jobId: string, intervalMs = 8000, maxAttempts = 90) {
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts++;
      const job = await this.getJob(jobId);
      if (!job || attempts >= maxAttempts) {
        clearInterval(timer);
        return;
      }
      if (job.status === "done" || job.status === "stopped" || job.status === "error") {
        clearInterval(timer);
        const startTime = this.jobStartTimes.get(jobId) ?? Date.now();
        this.jobStartTimes.delete(jobId);
        const durationSec = Math.max(0, Math.round((Date.now() - startTime) / 1000));
        this.saveJobLog(job, durationSec).catch(() => {});
        this.events.emit({
          event:
            job.status === "done"
              ? "job_complete"
              : job.status === "stopped"
                ? "job_stopped"
                : "error",
          phone_id: "",
          details: {
            job_id: job.job_id,
            service: job.service,
            progress: job.progress,
            total: job.total,
            errors_count: job.errors_count,
            status: job.status,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }, intervalMs);
  }

  private async saveJobLog(job: GenerationJob, durationSec: number): Promise<void> {
    const costUsd = job.cost_usd ?? 0;
    await this.prisma.generationJobLog.upsert({
      where: { jobId: job.job_id },
      update: { status: job.status, durationSec, videosCount: job.progress, costUsd },
      create: {
        jobId: job.job_id,
        service: job.service,
        durationSec,
        videosCount: job.progress,
        costUsd,
        status: job.status,
      },
    });
  }

  async getStats(): Promise<GenerationStats> {
    const rows = await this.prisma.generationJobLog.groupBy({
      by: ["service"],
      where: { status: "done" },
      _avg: { durationSec: true },
      _count: { id: true },
      _max: { createdAt: true },
    });

    const result: GenerationStats = {};
    for (const row of rows) {
      result[row.service] = {
        avg_sec: Math.round(row._avg.durationSec ?? 0),
        count: row._count.id,
        last_updated: row._max.createdAt?.toISOString() ?? new Date().toISOString(),
      };
    }
    return result;
  }

  private normalizeJob(
    raw: Record<string, unknown>,
    service: "sportzavod" | "contentzavod"
  ): GenerationJob {
    const status = this.normalizeStatus(raw.status);
    const isCz = service === "contentzavod";

    // content-zavod has no progress/total fields — treat each job as 1 video
    const total = typeof raw.total === "number" ? raw.total : isCz ? 1 : 0;
    const progress =
      typeof raw.progress === "number" ? raw.progress : isCz && status === "done" ? 1 : 0;

    return {
      job_id: String(raw.job_id ?? raw.id ?? crypto.randomUUID()),
      service,
      account_ids: Array.isArray(raw.account_ids)
        ? (raw.account_ids as string[])
        : raw.account_id
          ? [String(raw.account_id)]
          : [],
      topic: raw.topic != null ? String(raw.topic) : undefined,
      videos_per_account: typeof raw.videos_per_account === "number" ? raw.videos_per_account : 1,
      status,
      is_auto: raw.is_auto === true,
      progress,
      total,
      errors_count:
        typeof raw.errors_count === "number"
          ? raw.errors_count
          : Array.isArray(raw.errors)
            ? raw.errors.length
            : 0,
      created_at: raw.created_at != null ? String(raw.created_at) : new Date().toISOString(),
      results: Array.isArray(raw.results)
        ? (raw.results as Array<{ account_id: string; video_url: string }>)
        : undefined,
      cost_usd: typeof raw.cost_usd === "number" ? raw.cost_usd : 0,
      latest_log: typeof raw.latest_log === "string" && raw.latest_log ? raw.latest_log : undefined,
    };
  }

  private normalizeStatus(s: unknown): GenerationJob["status"] {
    if (s === "running") return "running";
    if (s === "stopping") return "stopping";
    if (s === "stopped") return "stopped";
    if (s === "done" || s === "completed" || s === "success" || s === "queued") return "done";
    if (s === "pending") return "running"; // content-zavod: pending = just started
    if (s === "waiting_approval") return "running"; // content-zavod: ждёт апрув в Telegram
    if (s === "not_relevant") return "stopped"; // content-zavod: тема нерелевантна
    if (s === "failed") return "error";
    return "error";
  }
}
