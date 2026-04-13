import type { FarmEvent, GenerationJob, GenerationJobEvent } from "@atome/shared";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { EventsGateway } from "../events/events.gateway";
import { PrismaService } from "../prisma/prisma.service";

type JobEventType = GenerationJobEvent["event_type"];
type JobEventLevel = GenerationJobEvent["level"];

interface AppendJobEventInput {
  jobId: string;
  service: "sportzavod" | "contentzavod" | "agentmusic";
  eventType: JobEventType;
  phase: string;
  message: string;
  status: GenerationJob["status"];
  progress?: number;
  total?: number;
  percent?: number | null;
  level?: JobEventLevel;
  payload?: Prisma.InputJsonValue;
}

@Injectable()
export class JobEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway
  ) {}

  async appendJobEvent(input: AppendJobEventInput): Promise<GenerationJobEvent | null> {
    const progress = input.progress ?? 0;
    const total = input.total ?? 0;
    const phase = input.phase || "running";
    const message = input.message.trim();
    const percent = this.resolvePercent(progress, total, input.percent);

    const last = await this.prisma.generationJobEvent.findFirst({
      where: { jobId: input.jobId },
      orderBy: { seq: "desc" },
    });

    if (
      last &&
      last.phase === phase &&
      last.message === message &&
      last.status === input.status &&
      last.progress === progress &&
      last.total === total
    ) {
      return null;
    }

    const nextSeq = (last?.seq ?? 0) + 1;
    const row = await this.prisma.generationJobEvent.create({
      data: {
        jobId: input.jobId,
        service: input.service,
        seq: nextSeq,
        eventType: input.eventType,
        phase,
        message,
        status: input.status,
        progress,
        total,
        percent,
        level: input.level ?? this.defaultLevelFor(input.eventType),
        payloadJson: input.payload,
      },
    });

    const event = this.toSharedEvent(row);
    this.events.emit(this.toFarmEvent(event));
    return event;
  }

  async listJobEvents(jobId: string, limit = 100): Promise<GenerationJobEvent[]> {
    const rows = await this.prisma.generationJobEvent.findMany({
      where: { jobId },
      orderBy: { seq: "desc" },
      take: limit,
    });
    return rows.reverse().map((row) => this.toSharedEvent(row));
  }

  async hydrateJobs<T extends GenerationJob>(jobs: T[]): Promise<T[]> {
    if (jobs.length === 0) return jobs;

    const latestRows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        jobId: string;
        service: string;
        seq: number;
        eventType: string;
        phase: string;
        message: string;
        status: string;
        progress: number;
        total: number;
        percent: number | null;
        level: string;
        payloadJson: Prisma.JsonValue | null;
        createdAt: Date;
      }>
    >`SELECT DISTINCT ON ("jobId") * FROM "GenerationJobEvent" WHERE "jobId" IN (${Prisma.join(
      jobs.map((job) => job.job_id)
    )}) ORDER BY "jobId", "seq" DESC`;

    const latestByJob = new Map(latestRows.map((row) => [row.jobId, this.toSharedEvent(row)]));
    return jobs.map((job) => this.hydrateJob(job, latestByJob.get(job.job_id)));
  }

  hydrateJob<T extends GenerationJob>(job: T, latest?: GenerationJobEvent | null): T {
    if (!latest) {
      return {
        ...job,
        percent: job.percent ?? this.resolvePercent(job.progress, job.total),
        started_at: job.started_at ?? job.created_at,
        updated_at: job.updated_at ?? job.created_at,
      };
    }

    return {
      ...job,
      current_phase: job.current_phase ?? latest.phase,
      current_message: job.current_message ?? latest.message,
      latest_log: job.latest_log ?? latest.message,
      percent: job.percent ?? latest.percent ?? this.resolvePercent(job.progress, job.total),
      started_at: job.started_at ?? job.created_at ?? latest.created_at,
      updated_at: job.updated_at ?? latest.created_at,
    };
  }

  resolvePercent(
    progress: number,
    total: number,
    explicitPercent?: number | null
  ): number | undefined {
    if (typeof explicitPercent === "number") return explicitPercent;
    if (total <= 0) return undefined;
    return Math.max(0, Math.min(100, Math.round((progress / total) * 100)));
  }

  private defaultLevelFor(eventType: JobEventType): JobEventLevel {
    if (eventType === "job_error") return "error";
    if (eventType === "job_stopped") return "warning";
    return "info";
  }

  private toSharedEvent(row: {
    id: string;
    jobId: string;
    service: string;
    seq: number;
    eventType: string;
    phase: string;
    message: string;
    status: string;
    progress: number;
    total: number;
    percent: number | null;
    level: string;
    payloadJson?: Prisma.JsonValue | null;
    createdAt: Date;
  }): GenerationJobEvent {
    return {
      id: row.id,
      job_id: row.jobId,
      service: row.service as GenerationJob["service"],
      seq: row.seq,
      event_type: row.eventType as JobEventType,
      phase: row.phase,
      message: row.message,
      status: row.status as GenerationJob["status"],
      progress: row.progress,
      total: row.total,
      percent: row.percent ?? undefined,
      level: row.level as JobEventLevel,
      created_at: row.createdAt.toISOString(),
      payload:
        row.payloadJson && typeof row.payloadJson === "object" && !Array.isArray(row.payloadJson)
          ? (row.payloadJson as Record<string, unknown>)
          : undefined,
    };
  }

  private toFarmEvent(event: GenerationJobEvent): FarmEvent {
    return {
      event:
        event.event_type === "job_error"
          ? "job_error"
          : event.event_type === "job_progress"
            ? "job_progress"
            : event.event_type === "job_log"
              ? "job_log"
              : event.event_type,
      phone_id: "",
      details: {
        job_id: event.job_id,
        service: event.service,
        phase: event.phase,
        message: event.message,
        status: event.status,
        progress: event.progress,
        total: event.total,
        percent: event.percent,
        level: event.level,
        created_at: event.created_at,
      },
      timestamp: event.created_at,
    };
  }
}
