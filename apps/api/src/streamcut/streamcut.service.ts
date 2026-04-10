import type { StreamCutJob, StreamCutVideoInfo } from "@atome/shared";
import { Injectable, Logger } from "@nestjs/common";
import { EventsGateway } from "../events/events.gateway";

interface StreamCutCreateJobDto {
  url: string;
  language?: string;
  max_shorts?: number;
  min_duration?: number;
  max_duration?: number;
  caption_style?: string;
  reframe_mode?: string;
  add_music?: string;
  footage_layout?: string;
  footage_category?: string;
  caption_position?: string;
  publish_targets?: string[];
}

const TERMINAL_STATUSES = new Set(["done", "error"]);
const SERVICE_ACCOUNT_USERNAME = "atome-dashboard";

@Injectable()
export class StreamCutService {
  private readonly logger = new Logger(StreamCutService.name);
  private readonly baseUrl = process.env.STREAMCUT_URL ?? "http://localhost:8003";
  private readonly servicePassword = process.env.STREAMCUT_SERVICE_PASSWORD ?? "atome-service-pw";

  private cachedToken: string | null = null;

  constructor(private readonly events: EventsGateway) {}

  // ── Auth bridging ──────────────────────────────────────────────────────────

  private async ensureToken(): Promise<string> {
    if (this.cachedToken) return this.cachedToken;
    return this.authenticate();
  }

  private async authenticate(): Promise<string> {
    // Try to register (idempotent — 409 if exists)
    try {
      await fetch(`${this.baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: SERVICE_ACCOUNT_USERNAME,
          password: this.servicePassword,
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Registration might fail if service is down — will fail on login below
    }

    // Login
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `username=${SERVICE_ACCOUNT_USERNAME}&password=${encodeURIComponent(this.servicePassword)}`,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      this.logger.error(`StreamCut auth failed: ${res.status}`);
      throw new Error("StreamCut authentication failed");
    }

    const data = (await res.json()) as { access_token: string };
    this.cachedToken = data.access_token;
    return data.access_token;
  }

  // ── HTTP helpers ───────────────────────────────────────────────────────────

  private async get<T>(path: string): Promise<T | null> {
    const doRequest = async (token: string) => {
      const res = await fetch(`${this.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      return res;
    };

    try {
      let token = await this.ensureToken();
      let res = await doRequest(token);

      // Re-auth on 401
      if (res.status === 401) {
        this.cachedToken = null;
        token = await this.authenticate();
        res = await doRequest(token);
      }

      if (!res.ok) return null;
      return res.json() as Promise<T>;
    } catch {
      this.logger.warn(`StreamCut unavailable: GET ${path}`);
      return null;
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T | null> {
    const doRequest = async (token: string) => {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      return res;
    };

    try {
      let token = await this.ensureToken();
      let res = await doRequest(token);

      if (res.status === 401) {
        this.cachedToken = null;
        token = await this.authenticate();
        res = await doRequest(token);
      }

      if (!res.ok) return null;
      return res.json() as Promise<T>;
    } catch {
      this.logger.warn(`StreamCut unavailable: POST ${path}`);
      return null;
    }
  }

  private async del(path: string): Promise<boolean> {
    const doRequest = async (token: string) => {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      return res;
    };

    try {
      let token = await this.ensureToken();
      let res = await doRequest(token);

      if (res.status === 401) {
        this.cachedToken = null;
        token = await this.authenticate();
        res = await doRequest(token);
      }

      return res.ok;
    } catch {
      this.logger.warn(`StreamCut unavailable: DELETE ${path}`);
      return false;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async getVideoInfo(url: string): Promise<StreamCutVideoInfo | null> {
    return this.get<StreamCutVideoInfo>(`/video-info?url=${encodeURIComponent(url)}`);
  }

  async createJob(dto: StreamCutCreateJobDto): Promise<StreamCutJob | null> {
    const job = await this.post<StreamCutJob>("/jobs", dto);
    if (job) {
      this.emitEvent(job, "job_started");
      this.pollJobUntilDone(job.job_id);
    }
    return job;
  }

  async listJobs(): Promise<StreamCutJob[]> {
    return (await this.get<StreamCutJob[]>("/jobs")) ?? [];
  }

  async getJob(id: string): Promise<StreamCutJob | null> {
    return this.get<StreamCutJob>(`/jobs/${id}`);
  }

  async deleteJob(id: string): Promise<boolean> {
    return this.del(`/jobs/${id}`);
  }

  async getFootageCategories(): Promise<string[]> {
    const data = await this.get<{ categories: string[] }>("/footage/categories");
    return data?.categories ?? [];
  }

  async proxyFile(path: string): Promise<{ stream: ReadableStream; contentType: string } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/storage/${path}`, {
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok || !res.body) return null;
      return {
        stream: res.body as unknown as ReadableStream,
        contentType: res.headers.get("content-type") ?? "video/mp4",
      };
    } catch {
      this.logger.warn(`StreamCut file proxy failed: /storage/${path}`);
      return null;
    }
  }

  // ── Job polling ────────────────────────────────────────────────────────────

  private async pollJobUntilDone(jobId: string) {
    const intervalMs = 5000;
    const maxAttempts = 360; // 30 minutes

    let lastStatus = "";
    let lastProgress = -1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, intervalMs));

      const job = await this.getJob(jobId);
      if (!job) continue;

      // Emit progress when status or progress changes
      if (job.status !== lastStatus || job.progress !== lastProgress) {
        lastStatus = job.status;
        lastProgress = job.progress;

        if (TERMINAL_STATUSES.has(job.status)) {
          this.emitEvent(job, job.status === "done" ? "job_complete" : "job_error");
          return;
        }
        this.emitEvent(job, "job_progress");
      }
    }

    this.logger.warn(`StreamCut job ${jobId} polling timeout`);
  }

  private emitEvent(
    job: StreamCutJob,
    eventType: "job_started" | "job_progress" | "job_complete" | "job_error"
  ) {
    this.events.emit({
      event: eventType,
      phone_id: "",
      timestamp: new Date().toISOString(),
      details: {
        service: "streamcut",
        job_id: job.job_id,
        status: job.status,
        progress: job.progress,
        message: job.message,
        shorts_count: job.shorts?.length ?? 0,
      },
    });
  }
}
