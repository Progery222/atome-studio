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
    return this.get<Phone[]>("/api/devices").then((r) => r ?? []);
  }

  getPhone(id: string): Promise<Phone | null> {
    return this.get<Phone>(`/api/devices/${id}`);
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
        heygen_avatar_id: undefined,
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
        const data = (await res.json()) as { reloaded?: number };
        return { ok: true, reloaded: data.reloaded };
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
