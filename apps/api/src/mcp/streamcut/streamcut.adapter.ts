import { type Service, STATUS_COLORS } from "@atome/shared";
import { Injectable, Logger } from "@nestjs/common";

/**
 * StreamCut Adapter
 * Checks StreamCut service health at :8003 and fetches active jobs.
 * Orbit index: 3 | Color: coral (online) / red (offline)
 */
@Injectable()
export class StreamCutAdapter {
  private readonly logger = new Logger(StreamCutAdapter.name);
  private readonly baseUrl = process.env.STREAMCUT_URL ?? "http://localhost:8003";

  async fetchServices(): Promise<Service[]> {
    let status: Service["status"] = "offline";
    let activeJobs = 0;

    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        status = "online";
        activeJobs = await this.fetchActiveJobs();
      } else {
        status = "degraded";
      }
    } catch {
      this.logger.warn("StreamCut unavailable");
    }

    return [
      {
        id: "streamcut",
        name: "StreamCut",
        status,
        col: STATUS_COLORS[status],
        oi: 3,
        a: Math.PI * 0.7,
        spd: -0.003,
        activeJobs,
      },
    ];
  }

  private async fetchActiveJobs(): Promise<number> {
    try {
      const res = await fetch(`${this.baseUrl}/jobs/active-count`, {
        signal: AbortSignal.timeout(3000),
      });
      const data = (await res.json()) as { count: number };
      return data.count;
    } catch {
      return 0;
    }
  }
}
