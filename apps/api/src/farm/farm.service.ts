import type { Account, Phone, SportZavodTheme } from "@atome/shared";
import { Injectable, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const INTERNAL_ONLY_HEADERS = new Set(["authorization", "cookie"]);

@Injectable()
export class FarmService {
  private readonly logger = new Logger(FarmService.name);
  private readonly farmApiUrl =
    process.env.ATOME_FARM_URL ??
    process.env.AUTONOMY_URL ??
    "http://10.8.0.1:8001";

  private async getApi<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${this.farmApiUrl}${path}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      return res.json() as Promise<T>;
    } catch {
      this.logger.warn(`Farm API unavailable: GET ${path}`);
      return null;
    }
  }

  // -------- Publish analytics (proxy в atome-farm) --------

  async getPublishEvents(params: {
    since_min?: number;
    phone_id?: string;
    platform?: string;
    status?: string;
    limit?: number;
  }): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.since_min !== undefined) qs.set("since_min", String(params.since_min));
    if (params.phone_id) qs.set("phone_id", params.phone_id);
    if (params.platform) qs.set("platform", params.platform);
    if (params.status) qs.set("status", params.status);
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    return (await this.getApi(`/api/publish/events?${qs.toString()}`)) ?? { items: [], count: 0 };
  }

  async getPublishTimeline(taskId: string): Promise<unknown> {
    return (await this.getApi(`/api/publish/timeline/${encodeURIComponent(taskId)}`)) ?? { error: "unavailable" };
  }

  async getPublishStats(sinceMin: number): Promise<unknown> {
    return (await this.getApi(`/api/publish/stats?since_min=${sinceMin}`)) ?? { total: 0, by_status: {} };
  }

  // -------- Generic proxy в atome-farm (для account-groups, account-import) --------

  async proxyGet(path: string): Promise<unknown> {
    try {
      const r = await fetch(`${this.farmApiUrl}${path}`, { signal: AbortSignal.timeout(8000) });
      return await r.json();
    } catch (e) {
      this.logger.warn(`proxyGet ${path} failed: ${(e as Error).message}`);
      return { error: "unavailable" };
    }
  }

  async proxyPost(path: string, body: unknown): Promise<unknown> {
    try {
      const r = await fetch(`${this.farmApiUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      return await r.json();
    } catch (e) {
      this.logger.warn(`proxyPost ${path} failed: ${(e as Error).message}`);
      return { error: "unavailable" };
    }
  }

  async proxyPatch(path: string, body: unknown): Promise<unknown> {
    try {
      const r = await fetch(`${this.farmApiUrl}${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      return await r.json();
    } catch (e) {
      return { error: "unavailable" };
    }
  }

  async proxyPut(path: string, body: unknown): Promise<unknown> {
    try {
      const r = await fetch(`${this.farmApiUrl}${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      return await r.json();
    } catch (e) {
      return { error: "unavailable" };
    }
  }

  async proxyFarmRequest(req: Request, res: Response): Promise<void> {
    const upstream = this.buildFarmUpstreamUrl(req.originalUrl || req.url || "/api/farm");
    return this.proxyRequest(req, res, upstream);
  }

  async proxyNodeAgentRequest(req: Request, res: Response): Promise<void> {
    if (!this.isValidNodeSecret(req)) {
      res.status(401).json({
        error_code: "node_agent_unauthorized",
        message: "node_agent secret is missing or invalid",
        details: {},
      });
      return;
    }

    const upstream = this.buildNodeAgentUpstreamUrl(req.originalUrl || req.url || "/api/nodes");
    return this.proxyRequest(req, res, upstream);
  }

  private async proxyRequest(req: Request, res: Response, upstream: string): Promise<void> {
    const headers = this.buildProxyHeaders(req);
    const method = req.method.toUpperCase();
    const requestBody = this.buildProxyBody(req, method);
    const timeoutMs = this.proxyTimeoutMs(req, upstream);

    try {
      const upstreamResponse = await fetch(upstream, {
        method,
        headers,
        body: requestBody,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });

      res.status(upstreamResponse.status);
      upstreamResponse.headers.forEach((value, key) => {
        const normalized = key.toLowerCase();
        if (!HOP_BY_HOP_HEADERS.has(normalized)) {
          res.setHeader(key, value);
        }
      });

      if (upstreamResponse.status === 204) {
        res.end();
        return;
      }

      const payload = Buffer.from(await upstreamResponse.arrayBuffer());
      res.send(payload);
    } catch (e) {
      const proxyPath = this.safeProxyPath(req);
      this.logger.warn(
        `farm proxy failed: ${proxyPath} timeout_ms=${timeoutMs} error=${(e as Error).message}`,
      );
      res.status(502).json({
        error_code: "farm_upstream_unavailable",
        message: "atome-farm upstream is unavailable",
        details: { upstream: this.safeUpstreamLabel(), path: proxyPath, timeout_ms: timeoutMs },
      });
    }
  }

  private proxyTimeoutMs(req: Request, upstream: string): number {
    const method = req.method.toUpperCase();
    const path = new URL(upstream, this.farmApiUrl).pathname;
    const isAccountPreparation =
      /\/api\/phones\/[^/]+\/accounts\/discover$/.test(path) ||
      /\/api\/accounts\/[^/]+\/creation\/start$/.test(path);
    if (isAccountPreparation) return 180_000;
    if (method !== "GET") return 60_000;
    return 30_000;
  }

  private safeProxyPath(req: Request): string {
    try {
      const publicUrl = new URL(req.originalUrl || req.url || "/api/farm", "http://atome-api.local");
      return `${req.method.toUpperCase()} ${publicUrl.pathname}`;
    } catch {
      return req.method.toUpperCase();
    }
  }

  private buildFarmUpstreamUrl(originalUrl: string): string {
    const publicUrl = new URL(originalUrl, "http://atome-api.local");
    const farmPath = publicUrl.pathname.replace(/^\/api\/farm\/?/, "");
    let upstreamPath: string;

    if (!farmPath || farmPath === "health") {
      upstreamPath = "/health";
    } else if (farmPath === "metrics") {
      upstreamPath = "/metrics";
    } else {
      upstreamPath = `/api/${farmPath}`;
    }

    const base = this.farmApiUrl.replace(/\/+$/, "");
    return `${base}${upstreamPath}${publicUrl.search}`;
  }

  private buildNodeAgentUpstreamUrl(originalUrl: string): string {
    const publicUrl = new URL(originalUrl, "http://atome-api.local");
    const upstreamPath = publicUrl.pathname.replace(/^\/api\/nodes/, "/api/nodes");
    const base = this.farmApiUrl.replace(/\/+$/, "");
    return `${base}${upstreamPath}${publicUrl.search}`;
  }

  private isValidNodeSecret(req: Request): boolean {
    const expected = (process.env.NODE_AGENT_SECRET ?? "").trim();
    const provided = this.headerValue(req.headers["x-node-secret"]);
    if (!expected || !provided) return false;

    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  private headerValue(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) return value[0];
    return value;
  }

  private buildProxyHeaders(req: Request): Headers {
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      const normalized = key.toLowerCase();
      if (HOP_BY_HOP_HEADERS.has(normalized) || INTERNAL_ONLY_HEADERS.has(normalized)) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) headers.append(key, item);
      } else if (value !== undefined) {
        headers.set(key, value);
      }
    }

    headers.set("x-atome-api-proxy", "atome-api");
    headers.set("x-forwarded-host", req.headers.host ?? "");
    headers.set("x-forwarded-proto", req.protocol ?? "http");

    if (req.body !== undefined && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    return headers;
  }

  private buildProxyBody(req: Request, method: string): string | undefined {
    if (method === "GET" || method === "HEAD") return undefined;
    const body = req.body as unknown;
    if (body === undefined || body === null) return undefined;
    if (typeof body === "string") return body;
    if (Buffer.isBuffer(body)) return body.toString("utf8");
    return JSON.stringify(body);
  }

  private safeUpstreamLabel(): string {
    try {
      const url = new URL(this.farmApiUrl);
      return `${url.protocol}//${url.host}`;
    } catch {
      return "configured upstream";
    }
  }

  private async get<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${this.farmApiUrl}${path}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      return res.json() as Promise<T>;
    } catch {
      this.logger.warn(`atome-farm unavailable: GET ${path}`);
      return null;
    }
  }

  private async getItems<T>(path: string): Promise<T[]> {
    const data = await this.get<unknown>(path);
    if (Array.isArray(data)) return data as T[];
    if (
      data &&
      typeof data === "object" &&
      Array.isArray((data as { items?: unknown }).items)
    ) {
      return (data as { items: T[] }).items;
    }
    return [];
  }

  private async post<T>(path: string, body?: unknown): Promise<T | null> {
    try {
      const res = await fetch(`${this.farmApiUrl}${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      return res.json() as Promise<T>;
    } catch {
      this.logger.warn(`atome-farm unavailable: POST ${path}`);
      return null;
    }
  }

  getPhones(): Promise<Phone[]> {
    return this.getItems<Record<string, unknown>>("/api/phones").then((items) =>
      items.map((d) => this.normalizePhone(d))
    );
  }

  getPhone(id: string): Promise<Phone | null> {
    return this.get<Record<string, unknown>>(`/api/phones/${id}`).then((d) =>
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
      accounts: Array.isArray(d.accounts_summary)
        ? (d.accounts_summary as Phone["accounts"])
        : Array.isArray(d.accounts)
          ? (d.accounts as Phone["accounts"])
          : [],
      // Relay doesn't return adb_connected; if device is listed as active,
      // that implies videorecorder has adb access — treat as connected.
      adb_connected: d.adb_connected != null ? Boolean(d.adb_connected) : isActive,
      node_id: String(d.node ?? d.node_id ?? ""),
    } as unknown as Phone;
  }

  pausePhone(id: string): Promise<{ ok: boolean }> {
    return this.post(`/api/phones/${id}/command`, { command: "pause" }).then((r) => ({ ok: r !== null }));
  }

  resumePhone(id: string): Promise<{ ok: boolean }> {
    return this.post(`/api/phones/${id}/command`, { command: "resume" }).then((r) => ({ ok: r !== null }));
  }

  getAccounts(): Promise<Account[]> {
    return this.getItems<Account>("/api/accounts");
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
      const res = await fetch(`${this.farmApiUrl}${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      return res.json() as Promise<T>;
    } catch {
      this.logger.warn(`atome-farm unavailable: PATCH ${path}`);
      return null;
    }
  }
}
