import type { SystemHealth, SystemHealthState, SystemServiceHealth } from "@atome/shared";
import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { allBreakers } from "../common/circuit-breaker";
import { ServicesService } from "../services/services.service";

const startedAt = Date.now();

@Controller("health")
export class HealthController {
  constructor(private readonly services: ServicesService) {}

  @Public()
  @Get()
  get(): SystemHealth {
    const breakers = allBreakers();
    const breakerByName = new Map(breakers.map((b) => [b.name, b]));
    const svcList = this.services.getAll();

    const items: SystemServiceHealth[] = svcList.map((s) => {
      const baseState: SystemHealthState =
        s.status === "online" ? "ok" : s.status === "degraded" ? "degraded" : "down";
      const stale = null;
      return {
        id: s.id,
        name: s.name,
        state: baseState,
        lastSuccessAt: null,
        staleSeconds: stale,
        circuitOpenSince: null,
        detail: s.status,
      };
    });

    // Inject circuit breaker rows so UI can show atome-farm dependent paths.
    for (const b of breakers) {
      const state: SystemHealthState =
        b.state === "open" ? "down" : b.state === "half-open" ? "degraded" : "ok";
      const last = b.lastSuccessAt ? new Date(b.lastSuccessAt).toISOString() : null;
      const stale = b.lastSuccessAt
        ? Math.floor((Date.now() - b.lastSuccessAt) / 1000)
        : null;
      items.push({
        id: b.name,
        name: b.name,
        state,
        lastSuccessAt: last,
        staleSeconds: stale,
        circuitOpenSince: b.openedAt ? new Date(b.openedAt).toISOString() : null,
        detail: `${b.state}, fails=${b.failureCount}`,
      });
    }
    void breakerByName;

    const overall: SystemHealthState = items.some((x) => x.state === "down")
      ? "down"
      : items.some((x) => x.state === "degraded")
        ? "degraded"
        : "ok";

    return {
      state: overall,
      generatedAt: new Date().toISOString(),
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      services: items,
    };
  }
}
