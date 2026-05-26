import type { Logger } from "@nestjs/common";

/**
 * OpenAI-compatible tool definition (vLLM Qwen3 supports the same schema).
 */
export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** If true, executor must require user confirmation before running. */
  destructive?: boolean;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  ctx: { logger: Logger; orchestratorBase: string },
) => Promise<unknown>;

interface RegisteredTool {
  def: ToolDef;
  handler: ToolHandler;
}

const REGISTRY = new Map<string, RegisteredTool>();

export function registerTool(def: ToolDef, handler: ToolHandler): void {
  REGISTRY.set(def.name, { def, handler });
}

export function getToolDefs(): ToolDef[] {
  return Array.from(REGISTRY.values()).map((t) => t.def);
}

export function getToolHandler(name: string): RegisteredTool | undefined {
  return REGISTRY.get(name);
}

export function listToolNames(): string[] {
  return Array.from(REGISTRY.keys());
}

// ─── Helper for tool implementations ─────────────────────────────────────────

export async function orchestratorFetch(
  base: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`orchestrator ${path} HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const ct = res.headers.get("content-type") ?? "";
  return ct.includes("application/json") ? res.json() : res.text();
}

// ─── Built-in tools ──────────────────────────────────────────────────────────

registerTool(
  {
    name: "create_account",
    description:
      "Создать новый TikTok-аккаунт фермы в orchestrator БД. " +
      "Используй когда оператор просит «добавь аккаунт» или присылает данные нового профиля.",
    parameters: {
      type: "object",
      properties: {
        username: { type: "string", description: "TikTok username без @" },
        niche: { type: "string", description: "Тематика: NFL, NBA, F1 и т.д." },
        phone_id: {
          type: "string",
          description: "Серийник телефона (опционально, можно привязать позже)",
        },
        tenant_id: { type: "string", description: "Tenant id, по умолчанию 'main'" },
        post_frequency_hours: { type: "number" },
        timezone: { type: "string" },
      },
      required: ["username", "niche"],
    },
  },
  async (args, { orchestratorBase }) => {
    const username = String(args.username).replace(/^@/, "");
    const body = {
      tenant_id: String(args.tenant_id ?? "main"),
      phone_id: args.phone_id ? String(args.phone_id) : "",
      platform: "tiktok",
      username,
      niche: String(args.niche),
      content_sources: [],
      heygen_avatar_id: null,
      post_frequency_hours: Number(args.post_frequency_hours ?? 24),
      timezone: String(args.timezone ?? "UTC"),
      health_score: 1.0,
      warmup_day: 0,
      status: "warmup",
      stats: { posts_today: 0, posts_total: 0, last_post: null },
    };
    return orchestratorFetch(orchestratorBase, "/api/accounts", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
);

registerTool(
  {
    name: "create_accounts",
    description:
      "Создать несколько аккаунтов одним запросом. Используй когда оператор " +
      "вставляет список или таблицу с несколькими профилями.",
    parameters: {
      type: "object",
      properties: {
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              username: { type: "string" },
              niche: { type: "string" },
              phone_id: { type: "string" },
            },
            required: ["username", "niche"],
          },
        },
      },
      required: ["rows"],
    },
  },
  async (args, ctx) => {
    const rows = (args.rows as Array<Record<string, unknown>>) ?? [];
    const results: Array<{ ok: boolean; username: string; error?: string }> = [];
    for (const row of rows) {
      try {
        await getToolHandler("create_account")?.handler(row, ctx);
        results.push({ ok: true, username: String(row.username) });
      } catch (e) {
        results.push({
          ok: false,
          username: String(row.username),
          error: (e as Error).message,
        });
      }
    }
    return { created: results.filter((r) => r.ok).length, total: rows.length, results };
  },
);

registerTool(
  {
    name: "get_accounts",
    description: "Получить список аккаунтов фермы (только из orchestrator, не SportZavod).",
    parameters: { type: "object", properties: {} },
  },
  async (_args, { orchestratorBase }) => {
    return orchestratorFetch(orchestratorBase, "/api/accounts");
  },
);

registerTool(
  {
    name: "get_devices",
    description: "Получить список телефонов фермы со статусами.",
    parameters: { type: "object", properties: {} },
  },
  async (_args, { orchestratorBase }) => {
    return orchestratorFetch(orchestratorBase, "/api/devices");
  },
);

registerTool(
  {
    name: "get_recent_tasks",
    description: "Получить последние задачи очереди публикации.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number" },
        status: {
          type: "string",
          enum: ["scheduled", "in_progress", "published", "failed"],
        },
      },
    },
  },
  async (args, { orchestratorBase }) => {
    const params = new URLSearchParams();
    if (args.limit) params.set("limit", String(args.limit));
    if (args.status) params.set("status", String(args.status));
    return orchestratorFetch(orchestratorBase, `/api/tasks?${params.toString()}`);
  },
);

registerTool(
  {
    name: "pause_account",
    description: "Поставить автономную сессию телефона на паузу.",
    parameters: {
      type: "object",
      properties: { serial: { type: "string" } },
      required: ["serial"],
    },
    destructive: true,
  },
  async (args, { orchestratorBase }) => {
    return orchestratorFetch(
      orchestratorBase,
      `/api/autonomy/sessions/${encodeURIComponent(String(args.serial))}/pause`,
      { method: "POST" },
    );
  },
);

registerTool(
  {
    name: "resume_account",
    description: "Снять паузу с автономной сессии телефона.",
    parameters: {
      type: "object",
      properties: { serial: { type: "string" } },
      required: ["serial"],
    },
  },
  async (args, { orchestratorBase }) => {
    return orchestratorFetch(
      orchestratorBase,
      `/api/autonomy/sessions/${encodeURIComponent(String(args.serial))}/resume`,
      { method: "POST" },
    );
  },
);

registerTool(
  {
    name: "start_warmup",
    description: "Запустить warmup на телефоне (создаёт цель warmup_day_1).",
    parameters: {
      type: "object",
      properties: {
        serial: { type: "string" },
        priority: { type: "number" },
      },
      required: ["serial"],
    },
  },
  async (args, { orchestratorBase }) => {
    return orchestratorFetch(orchestratorBase, "/api/goals", {
      method: "POST",
      body: JSON.stringify({
        serial: String(args.serial),
        kind: "warmup_day_1",
        priority: Number(args.priority ?? 5),
      }),
    });
  },
);
