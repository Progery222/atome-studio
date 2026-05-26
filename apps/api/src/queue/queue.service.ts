import type { QueueTask } from "@atome/shared";
import { HttpException, Injectable, Logger } from "@nestjs/common";
import { getBreaker } from "../common/circuit-breaker";

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly baseUrl =
    process.env.ATOME_FARM_URL ??
    process.env.AUTONOMY_URL ??
    "http://10.8.0.1:8001";
  private readonly breaker = getBreaker("atome-farm-queue");

  private async get<T>(path: string): Promise<T | null> {
    if (this.breaker.shouldSkip()) return null;
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        this.breaker.onFailure(`GET ${path} -> ${res.status}`);
        return null;
      }
      this.breaker.onSuccess();
      return res.json() as Promise<T>;
    } catch (e) {
      this.breaker.onFailure(`GET ${path}: ${(e as Error).message}`);
      return null;
    }
  }

  async getTasks(): Promise<QueueTask[]> {
    const data = await this.get<QueueTask[] | { items?: QueueTask[] }>("/api/jobs?limit=100");
    if (Array.isArray(data)) return data;
    return data?.items ?? [];
  }

  async createTask(body: unknown, idempotencyKey?: string): Promise<unknown> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    const res = await fetch(`${this.baseUrl}/api/jobs/publish`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      this.logger.warn(`POST /api/jobs/publish -> ${res.status}: ${text.slice(0, 200)}`);
      throw new HttpException(data as Record<string, unknown>, res.status);
    }
    return data;
  }
}
