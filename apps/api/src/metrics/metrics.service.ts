import type { MetricsHistoryPoint, MetricsHistoryResponse } from "@atome/shared";
import { Injectable } from "@nestjs/common";

const RESOLUTIONS: Record<string, number> = {
  "1h": 3600_000,
  "6h": 21_600_000,
  "1d": 86_400_000,
};

const PERIODS: Record<string, number> = {
  "7d": 7 * 86_400_000,
  "14d": 14 * 86_400_000,
  "30d": 30 * 86_400_000,
};

@Injectable()
export class MetricsService {
  private readonly points: MetricsHistoryPoint[] = [];

  constructor() {
    this.seed();
  }

  private seed() {
    const now = Date.now();
    const step = 3_600_000; // 1h
    for (let i = 30 * 24; i >= 0; i--) {
      const ts = now - i * step;
      this.points.push({
        ts,
        videos: Math.floor(Math.random() * 40 + 10),
        revenue: Math.floor(Math.random() * 200 + 50),
        cost: Math.floor(Math.random() * 80 + 20),
        accounts_active: Math.floor(Math.random() * 30 + 5),
        jobs_completed: Math.floor(Math.random() * 15 + 2),
      });
    }
  }

  append(point: Omit<MetricsHistoryPoint, "ts">) {
    this.points.push({ ts: Date.now(), ...point });
    if (this.points.length > 30 * 24 * 2) {
      this.points.splice(0, this.points.length - 30 * 24 * 2);
    }
  }

  getHistory(period = "30d", resolution = "1h"): MetricsHistoryResponse {
    const periodMs = PERIODS[period] ?? PERIODS["30d"];
    const resolutionMs = RESOLUTIONS[resolution] ?? RESOLUTIONS["1h"];
    const since = Date.now() - periodMs;

    const filtered = this.points.filter((p) => p.ts >= since);

    // Downsample: bucket by resolution
    const buckets = new Map<number, MetricsHistoryPoint[]>();
    for (const p of filtered) {
      const key = Math.floor(p.ts / resolutionMs) * resolutionMs;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)?.push(p);
    }

    const aggregated: MetricsHistoryPoint[] = [];
    for (const [ts, pts] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
      const avg = <K extends keyof Omit<MetricsHistoryPoint, "ts">>(k: K) =>
        Math.round(pts.reduce((s, p) => s + (p[k] as number), 0) / pts.length);
      aggregated.push({
        ts,
        videos: avg("videos"),
        revenue: avg("revenue"),
        cost: avg("cost"),
        accounts_active: avg("accounts_active"),
        jobs_completed: avg("jobs_completed"),
      });
    }

    return { period, resolution, points: aggregated };
  }
}
