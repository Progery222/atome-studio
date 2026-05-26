import { Injectable, Logger } from "@nestjs/common";
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

const ORCHESTRATOR_URL = process.env.AUTONOMY_URL ?? "http://localhost:8001";

interface BridgeState {
  ws: WebSocket | null;
  sessionId: string;
  buffer: string[];
  closed: boolean;
}

/**
 * ChatGateway
 *
 * Socket.io namespace: /ws/chat
 *
 * Per client: open a native WebSocket to orchestrator at
 *   ws://ORCHESTRATOR/ws/chat?session_id=<id>
 * Forward messages both ways.
 *
 * Client → orchestrator (wrapped into JSON text frames):
 *   event "message"    data { text, attachments? }
 *   event "answer"     data { question_id, value }
 *   event "confirm"    data { action_id }
 *   event "cancel"     data { action_id }
 *   event "interrupt"  data {}
 *
 * Orchestrator → client:  every JSON payload from upstream is forwarded
 *   as socket.emit("chat_event", payload)  — the payload.type tells
 *   the frontend what to render (connected / message / tool_call /
 *   tool_result / question / pending_action / interrupted / error /
 *   generate_video_done / post_sent / post_failed / ...).
 */
@Injectable()
@WebSocketGateway({
  cors: { origin: true },
  namespace: "/ws/chat",
  pingInterval: 25000,
  pingTimeout: 20000,
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly bridges = new Map<string, BridgeState>();

  afterInit() {
    this.logger.log(`ChatGateway initialised (orchestrator=${ORCHESTRATOR_URL})`);
  }

  handleConnection(client: Socket) {
    const sessionId =
      (client.handshake.query?.session_id as string | undefined) ||
      (client.handshake.auth?.session_id as string | undefined) ||
      client.id;
    const wsUrl = `${ORCHESTRATOR_URL.replace(/^http/, "ws")}/ws/chat?session_id=${encodeURIComponent(sessionId)}`;
    this.logger.log(`Client ${client.id} connect, bridging to ${wsUrl}`);

    const state: BridgeState = { ws: null, sessionId, buffer: [], closed: false };
    this.bridges.set(client.id, state);

    try {
      const ws = new WebSocket(wsUrl);
      state.ws = ws;

      ws.onopen = () => {
        this.logger.log(`Upstream WS open for client ${client.id} (session=${sessionId})`);
        for (const frame of state.buffer) ws.send(frame);
        state.buffer = [];
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data));
          client.emit("chat_event", data);
        } catch {
          client.emit("chat_event", { type: "raw", data: String(event.data) });
        }
      };

      ws.onerror = (e) => {
        this.logger.warn(`Upstream WS error (client ${client.id}): ${String((e as Event & { message?: string }).message ?? e)}`);
        client.emit("chat_event", {
          type: "error",
          code: "upstream_error",
          msg: "orchestrator WS error",
        });
      };

      ws.onclose = () => {
        this.logger.log(`Upstream WS closed for client ${client.id}`);
        if (!state.closed) {
          client.emit("chat_event", { type: "error", code: "upstream_closed", msg: "orchestrator disconnected" });
          client.disconnect(true);
        }
      };
    } catch (err) {
      this.logger.error(`Cannot open upstream WS: ${(err as Error).message}`);
      client.emit("chat_event", {
        type: "error",
        code: "upstream_unavailable",
        msg: (err as Error).message,
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const state = this.bridges.get(client.id);
    if (!state) return;
    state.closed = true;
    if (state.ws && state.ws.readyState !== WebSocket.CLOSED) {
      try {
        state.ws.close();
      } catch {}
    }
    this.bridges.delete(client.id);
    this.logger.log(`Client ${client.id} disconnected`);
  }

  // ─── Client → orchestrator proxies ──────────────────────────────────────

  @SubscribeMessage("message")
  onMessage(@ConnectedSocket() client: Socket, @MessageBody() body: { text?: string; attachments?: unknown }) {
    this.send(client, { type: "message", text: body?.text ?? "", attachments: body?.attachments });
  }

  @SubscribeMessage("answer")
  onAnswer(@ConnectedSocket() client: Socket, @MessageBody() body: { question_id: string; value: string }) {
    this.send(client, { type: "answer", question_id: body?.question_id, value: body?.value ?? "" });
  }

  @SubscribeMessage("confirm")
  onConfirm(@ConnectedSocket() client: Socket, @MessageBody() body: { action_id: string }) {
    this.send(client, { type: "confirm", action_id: body?.action_id });
  }

  @SubscribeMessage("cancel")
  onCancel(@ConnectedSocket() client: Socket, @MessageBody() body: { action_id: string }) {
    this.send(client, { type: "cancel", action_id: body?.action_id });
  }

  @SubscribeMessage("interrupt")
  onInterrupt(@ConnectedSocket() client: Socket) {
    this.send(client, { type: "interrupt" });
  }

  private send(client: Socket, payload: unknown) {
    const state = this.bridges.get(client.id);
    if (!state) return;
    const frame = JSON.stringify(payload);
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(frame);
    } else {
      state.buffer.push(frame);
    }
  }
}
