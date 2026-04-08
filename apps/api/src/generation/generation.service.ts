import type { GenerationCostReport, GenerationJob, GenerationStats } from "@atome/shared";
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JobEventsService } from "./job-events.service";

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
    private readonly prisma: PrismaService,
    private readonly jobEvents: JobEventsService
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
    const initialEvent = await this.jobEvents.appendJobEvent({
      jobId: job.job_id,
      service: job.service,
      eventType: "job_started",
      phase: job.current_phase ?? "queued",
      message: job.current_message ?? `Generation queued in ${job.service}`,
      status: job.status,
      progress: job.progress,
      total: job.total,
      percent: job.percent,
    });

    this.pollJobUntilDone(job.job_id);
    return this.jobEvents.hydrateJob(job, initialEvent);
  }

  async getJob(id: string): Promise<GenerationJob | null> {
    const service = this.jobServiceMap.get(id);
    if (!service) {
      // Try both services if mapping is unknown (e.g. after restart)
      for (const svc of ["sportzavod", "contentzavod"] as const) {
        const found = await this.getJobFromService(id, svc);
        if (found) {
          this.jobServiceMap.set(id, svc);
          return this.jobEvents.hydrateJob(found);
        }
      }
      return null;
    }

    const job = await this.getJobFromService(id, service);
    return job ? this.jobEvents.hydrateJob(job) : null;
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

    return this.jobEvents.hydrateJobs(jobs);
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
    const initialEvent = await this.jobEvents.appendJobEvent({
      jobId: job.job_id,
      service: "sportzavod",
      eventType: "job_started",
      phase: job.current_phase ?? "queued",
      message: job.current_message ?? "Auto-generation queued",
      status: job.status,
      progress: job.progress,
      total: job.total,
      percent: job.percent,
    });

    this.pollJobUntilDone(job.job_id);
    return this.jobEvents.hydrateJob(job, initialEvent);
  }

  async stopAllJobs(): Promise<{ stopped_count: number }> {
    const result = await this.post<{ stopped_count?: number }>(
      `${this.sportzavodUrl}/api/jobs/stop-all`,
      {}
    );
    return { stopped_count: result?.stopped_count ?? 0 };
  }

  async getJobEvents(id: string) {
    return this.jobEvents.listJobEvents(id, 100);
  }

  /** Poll a running job snapshot and persist meaningful timeline changes */
  private pollJobUntilDone(jobId: string, intervalMs = 3000, maxAttempts = 600) {
    let attempts = 0;
    let stoppingAttempts = 0;
    // Retry stop after 2 min stuck in stopping; force-timeout after 10 min
    const STOPPING_RETRY_AFTER = 40; // ~2 min
    const STOPPING_FORCE_AFTER = 200; // ~10 min

    const timer = setInterval(async () => {
      attempts++;
      const job = await this.getJob(jobId);
      if (!job || attempts >= maxAttempts) {
        clearInterval(timer);
        return;
      }
      await this.syncJobSnapshot(job);

      if (job.status === "stopping") {
        stoppingAttempts++;
        if (stoppingAttempts === STOPPING_RETRY_AFTER) {
          // Retry the stop request — job may not have received it
          this.stopJob(jobId).catch(() => {});
          this.logger.warn(`Job ${jobId} stuck in stopping — retrying stop`);
        } else if (stoppingAttempts >= STOPPING_FORCE_AFTER) {
          // Force-mark as stopped after 10 min
          this.logger.warn(`Job ${jobId} stuck in stopping — force-marking as stopped`);
          await this.jobEvents.appendJobEvent({
            jobId,
            service: job.service,
            eventType: "job_stopped",
            phase: "stopped",
            message: "Force-stopped after timeout",
            status: "stopped",
            progress: job.progress,
            total: job.total,
            percent: job.percent,
            level: "warning",
          });
          clearInterval(timer);
          const startTime =
            this.jobStartTimes.get(jobId) ??
            (job.started_at ? new Date(job.started_at).getTime() : Date.now());
          this.jobStartTimes.delete(jobId);
          const durationSec = Math.max(0, Math.round((Date.now() - startTime) / 1000));
          this.saveJobLog({ ...job, status: "stopped" }, durationSec).catch(() => {});
          return;
        }
      } else {
        stoppingAttempts = 0;
      }

      if (job.status === "done" || job.status === "stopped" || job.status === "error") {
        clearInterval(timer);
        const startTime =
          this.jobStartTimes.get(jobId) ??
          (job.started_at ? new Date(job.started_at).getTime() : Date.now());
        this.jobStartTimes.delete(jobId);
        const durationSec = Math.max(0, Math.round((Date.now() - startTime) / 1000));
        this.saveJobLog(job, durationSec).catch(() => {});
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

  private async syncJobSnapshot(job: GenerationJob): Promise<void> {
    const phase = job.current_phase ?? this.phaseFor(job);
    const message =
      job.current_message ??
      job.latest_log ??
      this.defaultMessageFor(job.service, phase, job.status);

    await this.jobEvents.appendJobEvent({
      jobId: job.job_id,
      service: job.service,
      eventType: this.eventTypeFor(job.status),
      phase,
      message,
      status: job.status,
      progress: job.progress,
      total: job.total,
      percent: job.percent,
      level: job.status === "error" ? "error" : job.status === "stopped" ? "warning" : "info",
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

  async getCostStats(): Promise<GenerationCostReport> {
    const rows = await this.prisma.generationJobLog.groupBy({
      by: ["service"],
      where: { status: "done", costUsd: { gt: 0 } },
      _sum: { costUsd: true, videosCount: true },
      _count: { id: true },
    });

    const services: GenerationCostReport["services"] = {};
    let totalCost = 0;
    let totalVideos = 0;
    let totalJobs = 0;

    for (const row of rows) {
      const cost = row._sum.costUsd ?? 0;
      const videos = row._sum.videosCount ?? 0;
      const jobs = row._count.id;
      services[row.service] = {
        total_usd: +cost.toFixed(4),
        avg_usd_per_video: videos > 0 ? +(cost / videos).toFixed(4) : 0,
        videos_count: videos,
        jobs_count: jobs,
      };
      totalCost += cost;
      totalVideos += videos;
      totalJobs += jobs;
    }

    return {
      services,
      total: {
        total_usd: +totalCost.toFixed(4),
        avg_usd_per_video: totalVideos > 0 ? +(totalCost / totalVideos).toFixed(4) : 0,
        videos_count: totalVideos,
        jobs_count: totalJobs,
      },
    };
  }

  private normalizeJob(
    raw: Record<string, unknown>,
    service: "sportzavod" | "contentzavod"
  ): GenerationJob {
    const isCz = service === "contentzavod";
    const rawResults = Array.isArray(raw.results) ? (raw.results as unknown[]) : null;

    // content-zavod: done with empty results = pipeline aborted (API error, no content found, etc.)
    const baseStatus = this.normalizeStatus(raw.status);
    const status =
      isCz && baseStatus === "done" && rawResults !== null && rawResults.length === 0
        ? "error"
        : baseStatus;

    // content-zavod has no progress/total fields — treat each job as 1 video
    const total = typeof raw.total === "number" ? raw.total : isCz ? 1 : 0;
    const progress =
      typeof raw.progress === "number"
        ? raw.progress
        : isCz && status === "done" && (!rawResults || rawResults.length > 0)
          ? 1
          : 0;

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
      current_phase:
        typeof raw.current_phase === "string" && raw.current_phase ? raw.current_phase : undefined,
      current_message: this.resolveErrorMessage(raw, status),
      // content-zavod provides real percent per phase (12/24/40...); SportZavod percent=99 is a marker, ignore it
      percent: this.jobEvents.resolvePercent(
        progress,
        total,
        isCz && typeof raw.percent === "number" ? raw.percent : undefined
      ),
      started_at:
        typeof raw.started_at === "string" && raw.started_at
          ? raw.started_at
          : raw.created_at != null
            ? String(raw.created_at)
            : new Date().toISOString(),
      updated_at:
        typeof raw.updated_at === "string" && raw.updated_at
          ? raw.updated_at
          : raw.created_at != null
            ? String(raw.created_at)
            : new Date().toISOString(),
    };
  }

  private eventTypeFor(
    status: GenerationJob["status"]
  ): "job_complete" | "job_stopped" | "job_error" | "job_progress" {
    if (status === "done") return "job_complete";
    if (status === "stopped") return "job_stopped";
    if (status === "error") return "job_error";
    return "job_progress";
  }

  private phaseFor(job: GenerationJob): string {
    if (job.status === "done") return "done";
    if (job.status === "error") return "error";
    if (job.status === "stopped") return "stopped";
    if (job.status === "stopping") return "stopping";
    return "running";
  }

  private defaultMessageFor(
    service: GenerationJob["service"],
    phase: string,
    status: GenerationJob["status"]
  ): string {
    if (status === "done") return `${service} completed`;
    if (status === "error") return `${service} failed`;
    if (status === "stopped") return `${service} stopped`;
    if (status === "stopping") return `${service} stopping`;
    return `${service} · ${phase}`;
  }

  private resolveErrorMessage(
    raw: Record<string, unknown>,
    status: GenerationJob["status"]
  ): string | undefined {
    // Explicit error message from service
    const explicit =
      typeof raw.error_message === "string" && raw.error_message
        ? raw.error_message
        : typeof raw.error === "string" && raw.error
          ? raw.error
          : typeof raw.abort_reason === "string" && raw.abort_reason
            ? raw.abort_reason
            : null;
    if (explicit) return explicit;

    // Errors array (e.g. content-zavod returns errors: ["msg1", "msg2"])
    if (Array.isArray(raw.errors) && raw.errors.length > 0) {
      return (raw.errors as unknown[]).map((e) => String(e)).join("; ");
    }

    // When we force-errored empty-results job, use latest_log as fallback message
    if (status === "error" && typeof raw.latest_log === "string" && raw.latest_log) {
      return raw.latest_log;
    }

    // Normal current_message from service
    if (typeof raw.current_message === "string" && raw.current_message) {
      return raw.current_message;
    }

    return undefined;
  }

  private normalizeStatus(s: unknown): GenerationJob["status"] {
    if (s === "running") return "running";
    if (s === "stopping") return "stopping";
    if (s === "stopped") return "stopped";
    if (s === "done" || s === "completed" || s === "success") return "done";
    if (s === "queued") return "running"; // content-zavod: queued = accepted, pipeline not yet done
    if (s === "pending") return "running"; // content-zavod: pending = just started
    if (s === "waiting_approval") return "running"; // content-zavod: ждёт апрув в Telegram
    if (s === "not_relevant") return "stopped"; // content-zavod: тема нерелевантна
    if (s === "failed") return "error";
    return "error";
  }
}
