import { EMPTY_FARM_STATS, type FarmStats, type Service, STATUS_COLORS } from "@atome/shared";
import { Injectable, Logger } from "@nestjs/common";

interface DashboardSummary {
  phones?: {
    total?: number;
    online?: number;
  };
  accounts?: {
    total?: number;
    active?: number;
  };
  publish?: {
    active_total?: number;
    recent_done?: number;
    recent?: Array<{ status?: string; finished_at?: string | null; updated_at?: string | null; created_at?: string | null }>;
  };
  alerts?: {
    open_total?: number;
    items?: Array<{ created_at?: string | null; message?: string | null; code?: string | null }>;
  };
}

/**
 * Farm Adapter (atome-farm)
 * Checks MVP backend health at /health and fetches Galaxy stats from
 * /api/dashboard/summary, which is the canonical atome-farm read model.
 * Orbit index: 2 | Color: green (online) / red (offline)
 */
@Injectable()
export class FarmAdapter {
  private readonly logger = new Logger(FarmAdapter.name);
  private readonly baseUrl =
    process.env.ATOME_FARM_URL ??
    process.env.AUTONOMY_URL ??
    "http://10.8.0.1:8001";

  async fetchServices(): Promise<Service[]> {
    let status: Service["status"] = "offline";

    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean };
        status = data.ok ? "online" : "degraded";
      } else {
        status = "degraded";
      }
    } catch {
      this.logger.warn("atome-farm unavailable");
    }

    return [
      {
        id: "atome-farm",
        name: "atome-farm",
        status,
        col: STATUS_COLORS[status],
        oi: 2,
        a: Math.PI / 2,
        spd: 0.002,
        activeJobs: 0,
      },
    ];
  }

  async fetchFarmStats(): Promise<FarmStats> {
    try {
      const [healthRes, summaryRes, devicesRes] = await Promise.allSettled([
        fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) }),
        fetch(`${this.baseUrl}/api/dashboard/summary?period=24h`, { signal: AbortSignal.timeout(5000) }),
        fetch(`${this.baseUrl}/api/phones`, { signal: AbortSignal.timeout(3000) }),
      ]);

      const stats: FarmStats = { ...EMPTY_FARM_STATS };

      if (summaryRes.status === "fulfilled" && summaryRes.value.ok) {
        const summary = (await summaryRes.value.json()) as DashboardSummary;
        stats.phones_total = Number(summary.phones?.total ?? 0);
        stats.phones_online = Number(summary.phones?.online ?? 0);
        stats.accounts_total = Number(summary.accounts?.total ?? 0);
        stats.accounts_active = Number(summary.accounts?.active ?? 0);
        stats.posts_today = Number(summary.publish?.recent_done ?? 0);
        stats.active_jobs = Number(summary.publish?.active_total ?? 0);
        stats.last_event = latestSummaryEvent(summary);
        return stats;
      }

      if (healthRes.status === "fulfilled" && healthRes.value.ok) {
        await healthRes.value.json().catch(() => ({}));
      }

      if (devicesRes.status === "fulfilled" && devicesRes.value.ok) {
        const data = (await devicesRes.value.json()) as
          | Array<{ status?: string }>
          | { items?: Array<{ status?: string }> };
        const devices = Array.isArray(data) ? data : (data.items ?? []);
        if (Array.isArray(devices)) {
          stats.phones_total = devices.length;
          stats.phones_online = devices.filter(
            (d) => d.status === "active" || d.status === "online"
          ).length;
        }
      }

      return stats;
    } catch {
      this.logger.warn("Failed to fetch farm stats");
      return { ...EMPTY_FARM_STATS };
    }
  }
}

function latestSummaryEvent(summary: DashboardSummary): string | undefined {
  const alert = summary.alerts?.items?.[0];
  if (alert?.message || alert?.code) {
    return alert.message ?? alert.code ?? undefined;
  }
  const recent = summary.publish?.recent?.[0];
  if (recent?.status) {
    return `publish ${recent.status}`;
  }
  return undefined;
}
