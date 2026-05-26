import type {
  AccountPlan,
  AutonomyStatus,
  AvailablePhone,
  CreateJobBody,
  FleetGroup,
  JobDetail,
  JobRow,
  Phone,
  ServicesRegistryResponse,
  StepRow,
  VhaPolicy,
} from "@atome/shared";
import { create } from "zustand";
import { apiFetch } from "../lib/api";

interface SyncSheetTab {
  title?: string;
  theme_key?: string;
  source?: string;
  gid?: string;
  rows_processed?: number;
  plans_emitted?: number;
  inserted?: number;
  updated?: number;
}
interface SyncSheetResult {
  ok?: boolean;
  // legacy single-tab response (back-compat)
  plans_emitted?: number;
  inserted?: number;
  updated?: number;
  // new multi-tab response
  tabs?: SyncSheetTab[];
  total_plans_emitted?: number;
  total_inserted?: number;
  total_updated?: number;
  [k: string]: unknown;
}

interface RediscoverResult {
  phone_id?: string;
  status?: string;
  [k: string]: unknown;
}

interface VhaState {
  fleetByPhoneId: Record<string, Phone>;
  groups: FleetGroup[];
  autonomyStatus: AutonomyStatus | null;
  fleetLoading: boolean;
  fetchFleet: () => Promise<void>;
  fetchAutonomy: () => Promise<void>;
  setPolicy: (vhaId: string, policy: VhaPolicy) => Promise<unknown>;
  runVhaNow: (vhaId: string) => Promise<unknown>;
  runProjectAll: (projectId: string) => Promise<unknown>;
  syncSheet: () => Promise<SyncSheetResult>;
  rediscoverPhone: (phoneId: string) => Promise<RediscoverResult>;
  detachPlan: (planId: string) => Promise<unknown>;
  bindPlan: (planId: string, phoneId: string) => Promise<unknown>;
  markAccountBanned: (accountId: string, reason: string) => Promise<unknown>;
  markPlanBanned: (planId: string, reason: string) => Promise<unknown>;
  syncBansFromSheet: () => Promise<unknown>;
  fetchPlans: (filters?: {
    state?: string;
    theme_key?: string;
    bound_phone_id?: string;
    platform?: string;
  }) => Promise<AccountPlan[]>;
  autofillPlan: (planId: string) => Promise<AutofillResult>;
  autofillAll: (opts?: {
    source?: string;
    theme_key?: string;
    limit?: number;
    concurrency?: number;
  }) => Promise<AutofillAllResult>;
  // Account creation wizard / jobs
  fetchServicesRegistry: () => Promise<ServicesRegistryResponse>;
  fetchAvailablePhones: (
    count?: number,
    mode?: "empty" | "all",
  ) => Promise<{ items: AvailablePhone[]; total: number }>;
  createAccountCreationJob: (
    body: CreateJobBody,
  ) => Promise<{ job_id: string; status: string }>;
  fetchJobs: (filters?: {
    status?: string;
    limit?: number;
  }) => Promise<{ items: JobRow[] }>;
  fetchJob: (jobId: string) => Promise<JobDetail>;
  fetchJobSteps: (
    jobId: string,
    filters?: { state?: string },
  ) => Promise<{ items: StepRow[] }>;
  cancelJob: (jobId: string) => Promise<unknown>;
  retryFailed: (jobId: string) => Promise<{ job_id: string }>;
  generateUsername: (themeKey: string, platform: string, persona?: Record<string, unknown>, used?: string[]) => Promise<{ username: string }>;
}

interface AutofillResult {
  ok?: boolean;
  plan_id?: string;
  filled_fields?: string[];
  error?: string;
  status?: number;
  [k: string]: unknown;
}

interface AutofillAllResult {
  ok?: boolean;
  total_plans?: number;
  total_filled_fields?: number;
  filled_per_plan?: Record<string, string[]>;
  error?: string;
  status?: number;
  [k: string]: unknown;
}

async function safeFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await apiFetch(path, init);
  } catch (e) {
    // apiFetch throws on non-2xx; convert to a synthetic 500 Response so
    // the caller can use `res.status`/`res.ok` uniformly without losing
    // the actual error message.
    const msg = (e as Error)?.message ?? "fetch failed";
    return new Response(JSON.stringify({ error: msg }), {
      status: msg.match(/^HTTP (\d+)/)
        ? Number(msg.match(/^HTTP (\d+)/)?.[1])
        : 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const useVhaStore = create<VhaState>((set) => ({
  fleetByPhoneId: {},
  groups: [],
  autonomyStatus: null,
  fleetLoading: false,

  fetchFleet: async () => {
    set({ fleetLoading: true });
    try {
      const res = await apiFetch("/api/farm/dashboard/fleet");
      if (!res.ok) {
        set({ fleetLoading: false });
        return;
      }
      const data = (await res.json()) as {
        items?: Array<Phone & { accounts?: unknown[] }>;
        groups?: FleetGroup[];
      };
      const map: Record<string, Phone> = {};
      for (const item of data.items ?? []) {
        if (!item?.phone_id) continue;
        // Backend fleet returns top-level "accounts" with VHA shape — alias to vha_accounts
        const vhaAccounts = Array.isArray(item.accounts)
          ? (item.accounts as Phone["vha_accounts"]) ?? null
          : null;
        const { accounts: _drop, ...rest } = item;
        map[item.phone_id] = { ...rest, vha_accounts: vhaAccounts } as Phone;
      }
      set({
        fleetByPhoneId: map,
        groups: data.groups ?? [],
        fleetLoading: false,
      });
    } catch (e) {
      console.warn("fetchFleet failed", e);
      set({ fleetLoading: false });
    }
  },

  fetchAutonomy: async () => {
    try {
      const res = await apiFetch("/api/farm/system/autonomy");
      if (!res.ok) return;
      const data = (await res.json()) as AutonomyStatus;
      set({ autonomyStatus: data });
    } catch (e) {
      console.warn("fetchAutonomy failed", e);
    }
  },

  setPolicy: async (vhaId, policy) => {
    const res = await apiFetch(`/api/farm/vhas/${vhaId}/policy`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policy }),
    });
    const json = await res.json().catch(() => ({}));
    return json;
  },

  runVhaNow: async (vhaId) => {
    const res = await apiFetch(`/api/farm/vhas/${vhaId}/decisions/run-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return res.json().catch(() => ({}));
  },

  runProjectAll: async (projectId) => {
    const res = await apiFetch(`/api/farm/projects/${projectId}/run-now-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return res.json().catch(() => ({}));
  },

  syncSheet: async () => {
    const res = await apiFetch("/api/farm/account-plans/sync-google-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`sync failed (${res.status}): ${text || res.statusText}`);
    }
    return (await res.json().catch(() => ({}))) as SyncSheetResult;
  },

  rediscoverPhone: async (phoneId) => {
    const res = await apiFetch(
      `/api/farm/phones/${phoneId}/discover-and-bind`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    if (!res.ok && res.status !== 202) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `rediscover failed (${res.status}): ${text || res.statusText}`,
      );
    }
    return (await res.json().catch(() => ({}))) as RediscoverResult;
  },

  detachPlan: async (planId) => {
    const res = await apiFetch(`/api/farm/account-plans/${planId}/detach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`detach failed (${res.status}): ${text || res.statusText}`);
    }
    return res.json().catch(() => ({}));
  },

  bindPlan: async (planId, phoneId) => {
    const res = await apiFetch(`/api/farm/account-plans/${planId}/bind`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_id: phoneId }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`bind failed (${res.status}): ${text || res.statusText}`);
    }
    return res.json().catch(() => ({}));
  },

  markAccountBanned: async (accountId, reason) => {
    const res = await apiFetch(`/api/farm/accounts/${accountId}/mark-banned`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `mark-banned failed (${res.status}): ${text || res.statusText}`,
      );
    }
    return res.json().catch(() => ({}));
  },

  markPlanBanned: async (planId, reason) => {
    const res = await apiFetch(
      `/api/farm/account-plans/${planId}/mark-banned`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `mark-banned failed (${res.status}): ${text || res.statusText}`,
      );
    }
    return res.json().catch(() => ({}));
  },

  syncBansFromSheet: async () => {
    const res = await apiFetch(
      "/api/farm/account-plans/sync-bans-from-sheet",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `sync-bans failed (${res.status}): ${text || res.statusText}`,
      );
    }
    return res.json().catch(() => ({}));
  },

  fetchPlans: async (filters) => {
    const qs = new URLSearchParams();
    if (filters?.state) qs.set("state", filters.state);
    if (filters?.theme_key) qs.set("theme_key", filters.theme_key);
    if (filters?.bound_phone_id) qs.set("bound_phone_id", filters.bound_phone_id);
    if (filters?.platform) qs.set("platform", filters.platform);
    const path =
      "/api/farm/account-plans" + (qs.toString() ? `?${qs.toString()}` : "");
    const res = await apiFetch(path);
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}) as unknown);
    if (Array.isArray(data)) return data as AccountPlan[];
    if (data && typeof data === "object") {
      const items = (data as { items?: unknown }).items;
      if (Array.isArray(items)) return items as AccountPlan[];
    }
    return [];
  },

  autofillPlan: async (planId) => {
    const res = await apiFetch(
      `/api/farm/account-plans/${planId}/autofill`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    const text = await res.text().catch(() => "");
    let parsed: AutofillResult = {};
    try {
      parsed = text ? (JSON.parse(text) as AutofillResult) : {};
    } catch {
      parsed = { error: text || res.statusText };
    }
    if (!res.ok) {
      return { ...parsed, ok: false, status: res.status };
    }
    return { ...parsed, ok: true, status: res.status };
  },

  autofillAll: async (opts) => {
    const qs = new URLSearchParams();
    if (opts?.source) qs.set("source", opts.source);
    if (opts?.theme_key) qs.set("theme_key", opts.theme_key);
    if (opts?.limit != null) qs.set("limit", String(opts.limit));
    if (opts?.concurrency != null)
      qs.set("concurrency", String(opts.concurrency));
    const path =
      "/api/farm/account-plans/autofill-all" +
      (qs.toString() ? `?${qs.toString()}` : "");
    const res = await apiFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        limit: opts?.limit ?? 100,
        concurrency: opts?.concurrency ?? 3,
      }),
    });
    const text = await res.text().catch(() => "");
    let parsed: AutofillAllResult = {};
    try {
      parsed = text ? (JSON.parse(text) as AutofillAllResult) : {};
    } catch {
      parsed = { error: text || res.statusText };
    }
    if (!res.ok) {
      return { ...parsed, ok: false, status: res.status };
    }
    return { ...parsed, ok: true, status: res.status };
  },

  // ─── Account creation wizard / jobs ─────────────────────────────────────────

  fetchServicesRegistry: async () => {
    const res = await safeFetch("/api/farm/services/registry");
    if (!res.ok) {
      return { services: [], platforms: [] } as ServicesRegistryResponse;
    }
    const data = (await res.json().catch(() => ({}))) as Partial<ServicesRegistryResponse>;
    return {
      services: Array.isArray(data.services) ? data.services : [],
      platforms: Array.isArray(data.platforms) ? data.platforms : [],
    } as ServicesRegistryResponse;
  },

  fetchAvailablePhones: async (count, mode) => {
    const c = count ?? 500;
    const m = mode ?? "empty";
    const res = await safeFetch(
      `/api/farm/account-creation/available-phones?count=${c}&mode=${m}`,
    );
    if (!res.ok) return { items: [], total: 0 };
    const data = (await res.json().catch(() => ({}))) as {
      items?: AvailablePhone[];
      total?: number;
    };
    return {
      items: Array.isArray(data.items) ? data.items : [],
      total: typeof data.total === "number" ? data.total : 0,
    };
  },

  createAccountCreationJob: async (body) => {
    const res = await safeFetch("/api/farm/account-creation/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `create job failed (${res.status}): ${text || res.statusText}`,
      );
    }
    const data = (await res.json().catch(() => ({}))) as {
      job_id?: string;
      status?: string;
    };
    if (!data.job_id) throw new Error("backend did not return job_id");
    return { job_id: data.job_id, status: data.status ?? "queued" };
  },

  fetchJobs: async (filters) => {
    const qs = new URLSearchParams();
    if (filters?.status) qs.set("status", filters.status);
    if (filters?.limit != null) qs.set("limit", String(filters.limit));
    const path =
      "/api/farm/account-creation/jobs" +
      (qs.toString() ? `?${qs.toString()}` : "");
    const res = await safeFetch(path);
    if (!res.ok) return { items: [] };
    const data = (await res.json().catch(() => ({}))) as { items?: JobRow[] };
    return { items: Array.isArray(data.items) ? data.items : [] };
  },

  fetchJob: async (jobId) => {
    const res = await safeFetch(`/api/farm/account-creation/jobs/${jobId}`);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `fetchJob failed (${res.status}): ${text || res.statusText}`,
      );
    }
    return (await res.json()) as JobDetail;
  },

  fetchJobSteps: async (jobId, filters) => {
    const qs = new URLSearchParams();
    if (filters?.state) qs.set("state", filters.state);
    const path =
      `/api/farm/account-creation/jobs/${jobId}/steps` +
      (qs.toString() ? `?${qs.toString()}` : "");
    const res = await safeFetch(path);
    if (!res.ok) return { items: [] };
    const data = (await res.json().catch(() => ({}))) as { items?: StepRow[] };
    return { items: Array.isArray(data.items) ? data.items : [] };
  },

  cancelJob: async (jobId) => {
    const res = await safeFetch(
      `/api/farm/account-creation/jobs/${jobId}/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    return res.json().catch(() => ({}));
  },

  retryFailed: async (jobId) => {
    const res = await safeFetch(
      `/api/farm/account-creation/jobs/${jobId}/retry-failed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `retry failed (${res.status}): ${text || res.statusText}`,
      );
    }
    const data = (await res.json().catch(() => ({}))) as { job_id?: string };
    return { job_id: data.job_id ?? jobId };
  },
  generateUsername: async (themeKey, platform, persona, used) => {
    const res = await safeFetch("/api/farm/account-creation/generate-username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        theme_key: themeKey,
        platform,
        persona: persona ?? {},
        used_usernames: used ?? [],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`generate-username failed (${res.status}): ${text || res.statusText}`);
    }
    const data = (await res.json().catch(() => ({}))) as { username?: string };
    return { username: data.username ?? "" };
  },
}));
