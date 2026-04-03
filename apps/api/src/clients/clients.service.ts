import type { Client } from "@atome/shared";
import { Injectable, Logger } from "@nestjs/common";

/** Fallback mock data returned when orchestrator is unavailable */
const MOCK_CLIENTS: Client[] = [
  {
    client_id: "mock-client-1",
    tenant_id: "tenant-mock-1",
    name: "Demo Client",
    email: "demo@example.com",
    plan: "pro",
    phones_limit: 10,
    phones_assigned: 0,
    accounts_count: 0,
    status: "active",
    created_at: new Date().toISOString(),
  },
];

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);
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

  private normalizeClient(raw: Record<string, unknown>): Client {
    return {
      client_id: String(raw.client_id ?? raw.id ?? crypto.randomUUID()),
      tenant_id: String(raw.tenant_id ?? raw.tenantId ?? ""),
      name: String(raw.name ?? ""),
      email: String(raw.email ?? ""),
      plan: this.normalizePlan(raw.plan),
      phones_limit: typeof raw.phones_limit === "number" ? raw.phones_limit : 0,
      phones_assigned: typeof raw.phones_assigned === "number" ? raw.phones_assigned : 0,
      accounts_count: typeof raw.accounts_count === "number" ? raw.accounts_count : 0,
      status: raw.status === "inactive" ? "inactive" : "active",
      created_at: raw.created_at != null ? String(raw.created_at) : new Date().toISOString(),
    };
  }

  private normalizePlan(p: unknown): Client["plan"] {
    if (p === "pro" || p === "enterprise") return p;
    return "basic";
  }

  async getClients(): Promise<Client[]> {
    const tenants = await this.get<Record<string, unknown>[]>("/api/tenants");
    if (!tenants) {
      this.logger.warn("Returning mock clients — orchestrator offline");
      return MOCK_CLIENTS;
    }
    return tenants.map((t) => this.normalizeClient(t));
  }

  async createClient(data: Partial<Client>): Promise<Client> {
    const result = await this.post<Record<string, unknown>>("/api/tenants", data);
    if (!result) {
      // Return optimistic mock so the UI can proceed
      const mock: Client = {
        client_id: crypto.randomUUID(),
        tenant_id: crypto.randomUUID(),
        name: data.name ?? "New Client",
        email: data.email ?? "",
        plan: data.plan ?? "basic",
        phones_limit: data.phones_limit ?? 0,
        phones_assigned: 0,
        accounts_count: 0,
        status: "active",
        created_at: new Date().toISOString(),
      };
      return mock;
    }
    return this.normalizeClient(result);
  }

  async updateClient(id: string, data: Partial<Client>): Promise<Client | null> {
    const result = await this.patch<Record<string, unknown>>(`/api/tenants/${id}`, data);
    return result ? this.normalizeClient(result) : null;
  }

  async assignPhones(id: string, phoneIds: string[]): Promise<{ ok: boolean }> {
    const result = await this.post(`/api/tenants/${id}/phones`, { phone_ids: phoneIds });
    return { ok: result !== null };
  }
}
