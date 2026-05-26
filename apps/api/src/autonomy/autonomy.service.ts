import type {
  AutonomySessionDetail,
  GlobalGoal,
  PhoneActionExecution,
  PhoneAnomalyEvent,
  PhoneAutonomySession,
  PhoneGoal,
  PhoneObservation,
  PhoneRecoveryAttempt,
} from "@atome/shared";
import { Injectable, Logger } from "@nestjs/common";
import { getBreaker } from "../common/circuit-breaker";
import { EventsGateway } from "../events/events.gateway";
import { unwrapEnvelope } from "./envelope";

@Injectable()
export class AutonomyService {
  private readonly logger = new Logger(AutonomyService.name);
  private readonly baseUrl =
    process.env.ATOME_FARM_URL ??
    process.env.AUTONOMY_URL ??
    "http://10.8.0.1:8001";
  private readonly breaker = getBreaker("atome-farm-autonomy");
  /** Last emitted snapshot key per channel to suppress no-op deltas */
  private lastSnap: Map<string, string> = new Map();

  constructor(private readonly events: EventsGateway) {}

  private emitIfChanged<T>(channel: string, payload: T) {
    const key = JSON.stringify(payload);
    if (this.lastSnap.get(channel) === key) return;
    this.lastSnap.set(channel, key);
    this.events.emitCustom(channel, { ts: Date.now(), data: payload });
  }

  // ── HTTP helpers ───────────────────────────────────────────────────────────

  private async get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T | null> {
    if (this.breaker.shouldSkip()) return null;
    const qs = query
      ? "?" +
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== "")
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join("&")
      : "";
    try {
      const res = await fetch(`${this.baseUrl}${path}${qs}`, {
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

  /**
   * atome-farm may wrap list responses in envelopes like `{sessions: [...]}`.
   * This helper unwraps whichever envelope key is present and returns a plain array.
   */
  private async getList<T>(
    path: string,
    envelopeKey: string,
    query?: Record<string, string | number | undefined>
  ): Promise<T[]> {
    const data = await this.get<unknown>(path, query);
    return unwrapEnvelope<T>(data, envelopeKey);
  }

  private async post<T>(path: string, body?: unknown): Promise<T | null> {
    // POST идёт всегда (write-action юзера) — обновим состояние брейкера по итогу.
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        this.breaker.onFailure(`POST ${path} -> ${res.status}`);
        return null;
      }
      this.breaker.onSuccess();
      return res.json() as Promise<T>;
    } catch (e) {
      this.breaker.onFailure(`POST ${path}: ${(e as Error).message}`);
      return null;
    }
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  async listSessions(activeOnly?: boolean): Promise<PhoneAutonomySession[]> {
    const sessions = await this.getList<PhoneAutonomySession>(
      "/api/autonomy/sessions",
      "sessions",
      { active_only: activeOnly ? "true" : undefined }
    );
    if (!activeOnly) this.emitIfChanged("autonomy:sessions", sessions);
    return sessions;
  }

  async getSession(serial: string): Promise<AutonomySessionDetail | null> {
    return this.get<AutonomySessionDetail>(`/api/autonomy/sessions/${serial}`);
  }

  async pauseSession(serial: string): Promise<unknown> {
    return (await this.post(`/api/autonomy/sessions/${serial}/pause`)) ?? { ok: false };
  }

  async resumeSession(serial: string): Promise<unknown> {
    return (await this.post(`/api/autonomy/sessions/${serial}/resume`)) ?? { ok: false };
  }

  async terminateSession(serial: string): Promise<unknown> {
    return (await this.post(`/api/autonomy/sessions/${serial}/terminate`)) ?? { ok: false };
  }

  async listActions(serial: string, limit = 50): Promise<PhoneActionExecution[]> {
    return this.getList<PhoneActionExecution>(
      `/api/autonomy/actions/${serial}/recent`,
      "actions",
      { limit }
    );
  }

  async listObservations(serial: string, limit = 20): Promise<PhoneObservation[]> {
    return this.getList<PhoneObservation>(
      `/api/autonomy/observations/${serial}/recent`,
      "observations",
      { limit }
    );
  }

  // ── Anomalies & Recoveries ─────────────────────────────────────────────────

  async listAnomalies(filters: {
    severity?: string;
    signature_id?: string;
    since?: string;
  } = {}): Promise<PhoneAnomalyEvent[]> {
    return this.getList<PhoneAnomalyEvent>("/api/autonomy/anomaly/events", "events", filters);
  }

  async listRecoveries(): Promise<PhoneRecoveryAttempt[]> {
    return this.getList<PhoneRecoveryAttempt>(
      "/api/autonomy/recoveries/recent",
      "recoveries"
    );
  }

  // ── Phone Goals ────────────────────────────────────────────────────────────

  async listGoals(filters: { status?: string; serial?: string } = {}): Promise<PhoneGoal[]> {
    return this.getList<PhoneGoal>("/api/goals", "goals", filters);
  }

  async getCurrentGoal(serial: string): Promise<PhoneGoal | null> {
    return this.get<PhoneGoal>(`/api/goals/${serial}/current`);
  }

  async createGoal(dto: unknown): Promise<PhoneGoal | null> {
    return this.post<PhoneGoal>("/api/goals", dto);
  }

  // ── Global Goals ───────────────────────────────────────────────────────────

  async listGlobalGoals(): Promise<GlobalGoal[]> {
    return this.getList<GlobalGoal>("/api/global_goals", "global_goals");
  }

  async createGlobalGoal(dto: unknown): Promise<GlobalGoal | null> {
    return this.post<GlobalGoal>("/api/global_goals", dto);
  }
}
