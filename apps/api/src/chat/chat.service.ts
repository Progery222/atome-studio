import { Injectable, Logger } from "@nestjs/common";
import { getToolDefs } from "./tool-registry";
import { ToolExecutor } from "./tool-executor";

const VLLM_URL = process.env.VLLM_URL ?? "http://91.84.98.58:8000";
const VLLM_MODEL = process.env.VLLM_MODEL ?? "Qwen3-VL-32B-AWQ";
const MAX_TURNS = 5;

const SYSTEM_PROMPT = `Ты — оператор фермы TikTok. Управляй через tools, отвечай по-русски кратко.

Правила:
- Аккаунты SportZavod НЕ мержатся со списком фермы — используй only get_accounts (orchestrator), не sportzavod_accounts.
- Для destructive действий (pause_account и т.п.) объясни что собираешься сделать.
- Не выдумывай данные — если нужен список, вызови get_devices/get_accounts/get_recent_tasks.
- При создании аккаунта проверь, что username не содержит @ (tool сам уберёт), niche обязательна.`;

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

interface VllmResponse {
  choices: Array<{
    message: ChatMessage;
    finish_reason?: string;
  }>;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly history = new Map<string, ChatMessage[]>();

  constructor(private readonly executor: ToolExecutor) {}

  async send(sessionId: string, text: string): Promise<{
    reply: string;
    toolCalls: Array<{ name: string; args: unknown; result?: unknown; error?: string }>;
  }> {
    const history = this.history.get(sessionId) ?? [
      { role: "system", content: SYSTEM_PROMPT },
    ];
    history.push({ role: "user", content: text });

    const auditTrail: Array<{
      name: string;
      args: unknown;
      result?: unknown;
      error?: string;
    }> = [];

    let finalText = "";
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const resp = await this.callLlm(history);
      const msg = resp.choices?.[0]?.message;
      if (!msg) {
        finalText = "(пустой ответ vLLM)";
        break;
      }
      history.push(msg);

      const calls = msg.tool_calls ?? [];
      if (calls.length === 0) {
        finalText = msg.content ?? "";
        break;
      }

      const results = await this.executor.run(sessionId, calls);
      for (let i = 0; i < calls.length; i++) {
        const c = calls[i];
        const r = results[i];
        let parsedArgs: unknown = c.function.arguments;
        try {
          parsedArgs = JSON.parse(c.function.arguments);
        } catch {
          // keep raw
        }
        auditTrail.push({
          name: c.function.name,
          args: parsedArgs,
          result: r.ok ? r.result : undefined,
          error: r.ok ? undefined : r.error,
        });
        history.push({
          role: "tool",
          tool_call_id: r.tool_call_id,
          name: r.name,
          content: JSON.stringify(r.ok ? { ok: true, result: r.result } : { ok: false, error: r.error }),
        });
      }
    }

    if (history.length > 40) {
      // trim, keep system + last 30
      const sys = history[0];
      this.history.set(sessionId, [sys, ...history.slice(-30)]);
    } else {
      this.history.set(sessionId, history);
    }

    return { reply: finalText, toolCalls: auditTrail };
  }

  reset(sessionId: string): void {
    this.history.delete(sessionId);
  }

  private async callLlm(messages: ChatMessage[]): Promise<VllmResponse> {
    const tools = getToolDefs().map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const res = await fetch(`${VLLM_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.4,
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`vLLM HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    return (await res.json()) as VllmResponse;
  }
}
