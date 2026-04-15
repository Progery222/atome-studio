import { EMPTY_FARM_STATS, type FarmStats, type Service, STATUS_COLORS } from "@atome/shared";
import { Injectable, Logger } from "@nestjs/common";

/**
 * Farm Adapter (farm-relay)
 * Checks relay health at /health and fetches farm stats via /api/devices.
 * Relay API: GET /health → {ok,nodes,streams}, GET /api/devices → [{serial,model,status}]
 * Orbit index: 2 | Color: green (online) / red (offline)
 */
@Injectable()
export class FarmAdapter {
  private readonly logger = new Logger(FarmAdapter.name);
  private readonly baseUrl = process.env.ORCHESTRATOR_URL ?? "http://localhost:8001";

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
      this.logger.warn("Orchestrator unavailable");
    }

    return [
      {
        id: "orchestrator",
        name: "Orchestrator",
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
      const [healthRes, devicesRes] = await Promise.allSettled([
        fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) }),
        fetch(`${this.baseUrl}/api/devices`, { signal: AbortSignal.timeout(3000) }),
      ]);

      const stats: FarmStats = { ...EMPTY_FARM_STATS };

      if (healthRes.status === "fulfilled" && healthRes.value.ok) {
        const data = (await healthRes.value.json()) as {
          ok?: boolean;
          nodes?: number;
          streams?: number;
        };
        stats.phones_total = data.nodes ?? 0;
      }

      if (devicesRes.status === "fulfilled" && devicesRes.value.ok) {
        const devices = (await devicesRes.value.json()) as Array<{ status?: string }>;
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
