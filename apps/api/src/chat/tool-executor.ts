import { Injectable, Logger } from "@nestjs/common";
import { getToolHandler } from "./tool-registry";

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_SESSION = 30;

interface ToolCall {
  id?: string;
  type?: string;
  function: { name: string; arguments: string };
}

interface ToolResult {
  tool_call_id: string;
  name: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

@Injectable()
export class ToolExecutor {
  private readonly logger = new Logger(ToolExecutor.name);
  private readonly orchestratorBase = process.env.ORCHESTRATOR_URL ?? "http://localhost:8001";
  private readonly counters = new Map<string, { count: number; reset: number }>();

  async run(sessionId: string, calls: ToolCall[]): Promise<ToolResult[]> {
    const out: ToolResult[] = [];
    for (const call of calls) {
      if (!this.takeRate(sessionId)) {
        out.push({
          tool_call_id: call.id ?? "",
          name: call.function.name,
          ok: false,
          error: `rate_limit: > ${RATE_LIMIT_PER_SESSION} tool calls / minute`,
        });
        continue;
      }

      const reg = getToolHandler(call.function.name);
      if (!reg) {
        out.push({
          tool_call_id: call.id ?? "",
          name: call.function.name,
          ok: false,
          error: `unknown_tool: ${call.function.name}`,
        });
        continue;
      }

      let args: Record<string, unknown>;
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch (e) {
        out.push({
          tool_call_id: call.id ?? "",
          name: call.function.name,
          ok: false,
          error: `bad_args: ${(e as Error).message}`,
        });
        continue;
      }

      this.logger.log(`[${sessionId}] tool ${call.function.name} ${JSON.stringify(args)}`);
      try {
        const result = await reg.handler(args, {
          logger: this.logger,
          orchestratorBase: this.orchestratorBase,
        });
        out.push({
          tool_call_id: call.id ?? "",
          name: call.function.name,
          ok: true,
          result,
        });
      } catch (e) {
        out.push({
          tool_call_id: call.id ?? "",
          name: call.function.name,
          ok: false,
          error: (e as Error).message,
        });
      }
    }
    return out;
  }

  private takeRate(sessionId: string): boolean {
    const now = Date.now();
    const cur = this.counters.get(sessionId);
    if (!cur || cur.reset < now) {
      this.counters.set(sessionId, { count: 1, reset: now + RATE_WINDOW_MS });
      return true;
    }
    if (cur.count >= RATE_LIMIT_PER_SESSION) return false;
    cur.count += 1;
    return true;
  }
}
