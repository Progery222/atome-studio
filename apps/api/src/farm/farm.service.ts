import type { Account, Phone, SportZavodTheme } from "@atome/shared";
import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class FarmService {
  private readonly logger = new Logger(FarmService.name);
  private readonly baseUrl = process.env.ORCHESTRATOR_URL ?? "http://localhost:8001";

  private async get<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      return res.json() as Promise<T>;
    } catch {
      this.logger.warn(`Orchestrator unavailable: GET ${path}`);
      return null;
    }
  }

  private async post<T>(path: string, body?: unknown): Promise<T | null> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      return res.json() as Promise<T>;
    } catch {
      this.logger.warn(`Orchestrator unavailable: POST ${path}`);
      return null;
    }
  }

  getPhones(): Promise<Phone[]> {
    return this.get<Array<Record<string, unknown>>>("/api/devices").then((r) =>
      (r ?? []).map((d) => this.normalizePhone(d))
    );
  }

  getPhone(id: string): Promise<Phone | null> {
    return this.get<Record<string, unknown>>(`/api/devices/${id}`).then((d) =>
      d ? this.normalizePhone(d) : null
    );
  }

  private normalizePhone(d: Record<string, unknown>): Phone {
    const serial = String(d.serial ?? d.phone_id ?? "");
    const rawStatus = d.status;
    const isActive = rawStatus === "active" || rawStatus === "online";
    // Frontend `Phone["status"]` union: active|warmup|paused|offline|banned|error
    let status: Phone["status"] = "offline";
    if (isActive) status = "active";
    else if (rawStatus === "warmup") status = "warmup";
    else if (rawStatus === "paused") status = "paused";
    else if (rawStatus === "banned") status = "banned";
    else if (rawStatus === "error") status = "error";
    return {
      phone_id: String(d.phone_id ?? d.serial ?? ""),
      serial,
      model: d.model ? String(d.model) : undefined,
      status,
      warmup_day: Number(d.warmup_day ?? 0),
      health_score: d.health_score != null ? Number(d.health_score) : isActive ? 100 : 0,
      accounts: Array.isArray(d.accounts) ? (d.accounts as Phone["accounts"]) : [],
      // Relay doesn't return adb_connected; if device is listed as active,
      // that implies videorecorder has adb access — treat as connected.
      adb_connected: d.adb_connected != null ? Boolean(d.adb_connected) : isActive,
      node_id: String(d.node ?? d.node_id ?? ""),
    } as unknown as Phone;
  }

  pausePhone(id: string): Promise<{ ok: boolean }> {
    return this.post(`/api/devices/${id}/pause`).then((r) => ({ ok: r !== null }));
  }

  resumePhone(id: string): Promise<{ ok: boolean }> {
    return this.post(`/api/devices/${id}/resume`).then((r) => ({ ok: r !== null }));
  }

  getAccounts(): Promise<Account[]> {
    return this.get<Account[]>("/api/accounts").then((r) => r ?? []);
  }

  getAccount(id: string): Promise<Account | null> {
    return this.get<Account>(`/api/accounts/${id}`);
  }

  createAccount(data: Partial<Account>): Promise<Account | null> {
    return this.post<Account>("/api/accounts", data);
  }

  updateAccount(id: string, data: Partial<Account>): Promise<Account | null> {
    return this.patch<Account>(`/api/accounts/${id}`, data);
  }

  async getSportzavodAccounts(): Promise<Account[]> {
    const sportzavodUrl = process.env.SPORTZAVOD_URL ?? "http://localhost:8000";
    try {
      const res = await fetch(`${sportzavodUrl}/api/accounts`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const raw = (await res.json()) as Array<{
        id: number;
        instagram: string;
        theme_key?: string;
        theme_name?: string;
        style?: string;
        project?: string;
        topic_key?: string;
        has_avatar?: boolean;
      }>;
      return raw.map((sz) => ({
        account_id: String(sz.id),
        tenant_id: "sportzavod",
        phone_id: "",
        platform: "tiktok" as const,
        username: sz.instagram,
        niche: sz.theme_name ?? sz.theme_key ?? "",
        content_sources: sz.project ? [sz.project] : [],
        heygen_avatar_id: sz.has_avatar ? `sz-${sz.id}` : undefined,
        post_frequency_hours: 24,
        timezone: "UTC",
        health_score: 100,
        warmup_day: 0,
        status: "active" as const,
        stats: {
          posts_today: 0,
          posts_week: 0,
          posts_total: 0,
          last_post: null,
        },
      }));
    } catch {
      this.logger.warn("SportZavod unavailable: GET /api/accounts");
      return [];
    }
  }

  async getSportzavodThemes(): Promise<SportZavodTheme[]> {
    const sportzavodUrl = process.env.SPORTZAVOD_URL ?? "http://localhost:8000";
    try {
      const res = await fetch(`${sportzavodUrl}/api/themes`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      return (await res.json()) as SportZavodTheme[];
    } catch {
      this.logger.warn("SportZavod unavailable: GET /api/themes");
      return [];
    }
  }

  reloadAccounts(): Promise<{ ok: boolean; reloaded?: number }> {
    const sportzavodUrl = process.env.SPORTZAVOD_URL ?? "http://localhost:8000";
    return fetch(`${sportzavodUrl}/api/accounts/reload`, {
      method: "POST",
      signal: AbortSignal.timeout(10000),
    })
      .then(async (res) => {
        if (!res.ok) return { ok: false };
        const data = (await res.json()) as { loaded?: number; reloaded?: number };
        return { ok: true, reloaded: data.reloaded ?? data.loaded };
      })
      .catch(() => {
        this.logger.warn("SportZavod unavailable: POST /api/accounts/reload");
        return { ok: false };
      });
  }

  private async patch<T>(path: string, body: unknown): Promise<T | null> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      return res.json() as Promise<T>;
    } catch {
      this.logger.warn(`Orchestrator unavailable: PATCH ${path}`);
      return null;
    }
  }
}
