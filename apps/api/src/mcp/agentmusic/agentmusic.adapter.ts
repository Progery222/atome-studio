import { type Service, STATUS_COLORS } from "@atome/shared";
import { Injectable, Logger } from "@nestjs/common";

/**
 * agentMUSIC Adapter
 * Checks agentMUSIC Telegram bot API health and fetches active jobs.
 * Orbit index: 4 | Color: cyan/music theme
 */
@Injectable()
export class AgentMusicAdapter {
  private readonly logger = new Logger(AgentMusicAdapter.name);
  private readonly baseUrl = process.env.AGENTMUSIC_URL ?? "http://localhost:8080";

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
      this.logger.warn("agentMUSIC unavailable");
    }

    return [
      {
        id: "agentmusic",
        name: "agentMUSIC",
        status,
        col: STATUS_COLORS[status],
        oi: 4,
        a: Math.PI * 0.7,
        spd: 0.003,
        activeJobs,
      },
    ];
  }

  private async fetchActiveJobs(): Promise<number> {
    try {
      const res = await fetch(`${this.baseUrl}/api/jobs`, {
        signal: AbortSignal.timeout(3000),
      });
      const jobs = (await res.json()) as { status: string }[];
      return jobs.filter((j) => j.status === "running").length;
    } catch {
      return 0;
    }
  }
}
