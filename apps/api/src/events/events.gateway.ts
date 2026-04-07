import type { FarmEvent } from "@atome/shared";
import { Injectable, Logger } from "@nestjs/common";
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? "http://localhost:8001";
const POLL_INTERVAL_MS = 5_000; // polling fallback every 5 s
const RECONNECT_MS = 10_000; // try to reconnect WS bridge every 10 s

/**
 * EventsGateway
 *
 * Bridges the browser (Socket.io) ↔ Orchestrator (/ws/events).
 *
 * Strategy:
 * 1. Try to connect to Orchestrator via native WebSocket (Node 22 built-in).
 * 2. If that fails (service offline), fall back to polling GET /api/status
 *    every 5 s and emitting the result as a 'farm_event' to all connected clients.
 * 3. Every 10 s we attempt to (re)establish the WS connection.
 */
@Injectable()
@WebSocketGateway({ cors: { origin: true }, namespace: "/ws" })
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private ws: WebSocket | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;
  private usingPoll = false;

  afterInit() {
    this.logger.log("EventsGateway initialised");
    this.connectWebSocket();
    // Try to (re)connect every 10 s in case orchestrator comes back online
    this.reconnectTimer = setInterval(() => this.connectWebSocket(), RECONNECT_MS);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ─── Public emit helper (for GenerationService / ServicesService) ─────────

  emit(event: FarmEvent) {
    this.server?.emit("farm_event", event);
  }

  // ─── WebSocket bridge ──────────────────────────────────────────────────────

  private connectWebSocket() {
    if (this.ws) {
      // Don't re-open if already connected
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        return;
      }
      // Clean up stale socket
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    const wsUrl = `${ORCHESTRATOR_URL.replace(/^http/, "ws")}/ws/events`;

    try {
      // Node 22 has global WebSocket; use it directly
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.logger.log(`WS bridge connected to ${wsUrl}`);
        this.stopPolling();
        this.usingPoll = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data));
          this.server.emit("farm_event", data);
        } catch {
          // non-JSON frame — forward as-is
          this.server.emit("farm_event", { raw: event.data });
        }
      };

      this.ws.onerror = () => {
        this.logger.warn(`WS bridge error — falling back to polling`);
        this.startPolling();
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.logger.warn(`WS bridge closed — falling back to polling`);
        this.startPolling();
      };
    } catch (err) {
      this.logger.warn(`Cannot create WebSocket (${err}) — using polling fallback`);
      this.startPolling();
    }
  }

  // ─── Polling fallback ──────────────────────────────────────────────────────

  private startPolling() {
    if (this.usingPoll) return;
    this.usingPoll = true;
    this.logger.log(`Starting polling fallback every ${POLL_INTERVAL_MS}ms`);
    this.pollTimer = setInterval(() => this.pollStatus(), POLL_INTERVAL_MS);
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.usingPoll = false;
  }

  private async pollStatus() {
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/api/status`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return;

      const data = await res.json();
      this.server.emit("farm_event", {
        event: "heartbeat",
        phone_id: "",
        details: data,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Orchestrator still offline — silent
    }
  }
}
