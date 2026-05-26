import type { IncomingMessage, Server } from "node:http";
import type { Socket } from "node:net";
import type { JwtService } from "@nestjs/jwt";
import { WebSocket, WebSocketServer } from "ws";

const WS_PROXY_PATH = "/ws/farm/events";
const FARM_WS_PATH = "/ws/events";
const JWT_SUBPROTOCOL = "atome.jwt";

function addToken(tokens: string[], token: string | null | undefined): void {
  if (token && !tokens.includes(token)) tokens.push(token);
}

function readProtocolToken(req: IncomingMessage): string | null {
  const raw = req.headers["sec-websocket-protocol"];
  if (typeof raw !== "string") return null;
  const protocols = raw.split(",").map((part) => part.trim()).filter(Boolean);
  const marker = protocols.indexOf(JWT_SUBPROTOCOL);
  return marker >= 0 ? protocols[marker + 1] ?? null : null;
}

function readTokens(req: IncomingMessage): string[] {
  const tokens: string[] = [];
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    addToken(tokens, auth.slice(7));
  }

  addToken(tokens, readProtocolToken(req));

  const rawCookie = req.headers.cookie;
  if (rawCookie) {
    for (const part of rawCookie.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === "at") addToken(tokens, decodeURIComponent(rest.join("=")));
    }
  }

  return tokens;
}

function reject(socket: Socket, status: number, message: string): void {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function upstreamUrl(): string {
  const base =
    process.env.ATOME_FARM_URL ??
    process.env.AUTONOMY_URL ??
    "http://10.8.0.1:8001";
  const wsBase = base.replace(/^http/i, "ws").replace(/\/+$/, "");
  return `${wsBase}${FARM_WS_PATH}`;
}

export function installFarmWsProxy(server: Server, jwt: JwtService): void {
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    handleProtocols: (protocols) => (protocols.has(JWT_SUBPROTOCOL) ? JWT_SUBPROTOCOL : false),
  });

  server.prependListener("upgrade", (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const requestUrl = new URL(req.url ?? "/", "http://atome-api.local");
    if (requestUrl.pathname !== WS_PROXY_PATH) return;

    const tokens = readTokens(req);
    if (tokens.length === 0) {
      reject(socket, 401, "Unauthorized");
      return;
    }

    const verified = tokens.some((token) => {
      try {
        jwt.verify(token);
        return true;
      } catch {
        return false;
      }
    });

    if (!verified) {
      reject(socket, 401, "Unauthorized");
      return;
    }

    wss.handleUpgrade(req, socket, head, (client) => {
      const upstream = new WebSocket(upstreamUrl(), {
        headers: { "X-Atome-Api-Proxy": "atome-api" },
        perMessageDeflate: false,
      });

      upstream.on("open", () => {
        client.on("message", (data, isBinary) => {
          if (upstream.readyState === WebSocket.OPEN) {
            upstream.send(data, { binary: isBinary });
          }
        });

        upstream.on("message", (data, isBinary) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(data, { binary: isBinary });
          }
        });
      });

      const closeBoth = () => {
        if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
          client.close();
        }
        if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
          upstream.close();
        }
      };

      client.on("close", closeBoth);
      upstream.on("close", closeBoth);
      client.on("error", closeBoth);
      upstream.on("error", closeBoth);
    });
  });
}
