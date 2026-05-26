import { useCallback, useEffect, useRef } from "react";
import { NAL_TYPE, parseNalUnits, spsToCodecString } from "./h264-parser";

const MAX_DECODE_QUEUE = 3;
const WS_RECONNECT_DELAY = 2000;

interface PhoneStreamProps {
  serial: string;
  host?: string;
  port?: number;
  farmBackendUrl?: string;
  className?: string;
  onClick?: () => void;
  thumb?: boolean;
  interval?: number;
  onStatus?: (status: "connecting" | "connected" | "streaming" | "error" | "closed") => void;
}

export function PhoneStream({
  serial,
  host,
  port = 8800,
  className = "",
  onStatus,
}: PhoneStreamProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const decoderRef = useRef<VideoDecoder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const tsRef = useRef<number>(0);
  const gotKeyRef = useRef<boolean>(false);
  const mountedRef = useRef(true);
  const codecRef = useRef<string>("");
  const pendingFrameRef = useRef<VideoFrame | null>(null);
  const rafRef = useRef<number>(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const dragRef = useRef<{ startX: number; startY: number; startTime: number } | null>(null);
  const phoneRes = useRef({ w: 720, h: 1600 });

  const relayWsUrl = (() => {
    if (host) return `ws://${host}:${port}/ws/stream/${serial}`;
    const isDev =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (isDev) return `ws://localhost:${port}/ws/stream/${serial}`;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/relay/ws/${serial}`;
  })();

  const renderLoop = useCallback(() => {
    const frame = pendingFrameRef.current;
    if (frame) {
      pendingFrameRef.current = null;
      const canvas = canvasRef.current;
      if (canvas) {
        if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
          canvas.width = frame.displayWidth;
          canvas.height = frame.displayHeight;
          ctxRef.current = canvas.getContext("2d");
        }
        phoneRes.current = { w: frame.displayWidth, h: frame.displayHeight };
        ctxRef.current?.drawImage(frame, 0, 0);
        onStatusRef.current?.("streaming");
      }
      frame.close();
    }
    if (mountedRef.current) {
      rafRef.current = requestAnimationFrame(renderLoop);
    }
  }, []);

  const initDecoder = useCallback(
    (codec: string) => {
      try {
        decoderRef.current?.close();
      } catch {}
      gotKeyRef.current = false;
      codecRef.current = codec;

      if (typeof VideoDecoder === "undefined") return;

      const decoder = new VideoDecoder({
        output: (frame) => {
          pendingFrameRef.current?.close();
          pendingFrameRef.current = frame;
        },
        error: () => {
          // Null out broken decoder — next SPS+IDR will recreate it
          decoderRef.current = null;
          codecRef.current = "";
          gotKeyRef.current = false;
        },
      });

      try {
        (decoder as any).configure({
          codec,
          avc: { format: "annexb" },
          optimizeForLatency: true,
        });
        decoderRef.current = decoder;
      } catch {}
    },
    [],
  );

  const sendCommand = useCallback((cmd: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(cmd));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    tsRef.current = 0;

    if (canvasRef.current) {
      ctxRef.current = canvasRef.current.getContext("2d");
    }

    initDecoder("avc1.42E01E");
    rafRef.current = requestAnimationFrame(renderLoop);

    function connect() {
      if (!mountedRef.current) return;
      console.log("[PhoneStream]", serial, "connecting to", relayWsUrl);

      onStatusRef.current?.("connecting");
      const ws = new WebSocket(relayWsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[PhoneStream]", serial, "WS open");
        onStatusRef.current?.("connected");
      };

      let msgCount = 0;
      ws.onmessage = (event) => {
        if (!(event.data instanceof ArrayBuffer)) return;
        msgCount++;
        if (msgCount <= 3) console.log("[PhoneStream]", serial, "msg", msgCount, "bytes:", event.data.byteLength);

        const data = new Uint8Array(event.data);
        const nals = parseNalUnits(data);
        let hasIDR = false;
        let detectedCodec: string | null = null;

        for (const nal of nals) {
          if (nal.type === NAL_TYPE.SPS) {
            detectedCodec = spsToCodecString(nal.data);
          }
          if (nal.type === NAL_TYPE.IDR) {
            hasIDR = true;
          }
        }

        if (hasIDR && detectedCodec && detectedCodec !== codecRef.current) {
          initDecoder(detectedCodec);
          gotKeyRef.current = true;
        } else if (hasIDR) {
          gotKeyRef.current = true;
        }

        if (!hasIDR && !gotKeyRef.current) return;

        const decoder = decoderRef.current;
        if (!decoder || decoder.state !== "configured") return;
        if (decoder.decodeQueueSize > MAX_DECODE_QUEUE) return;

        try {
          decoder.decode(
            new EncodedVideoChunk({
              type: hasIDR ? "key" : "delta",
              timestamp: tsRef.current,
              data: event.data,
            })
          );
          tsRef.current += 66666;
        } catch {
          decoderRef.current = null;
          codecRef.current = "";
          gotKeyRef.current = false;
        }
      };

      ws.onclose = (ev) => {
        console.log("[PhoneStream]", serial, "WS closed, code:", ev.code, "reason:", ev.reason);
        onStatusRef.current?.("closed");
        if (mountedRef.current) {
          reconnectTimer.current = setTimeout(connect, WS_RECONNECT_DELAY);
        }
      };

      ws.onerror = (ev) => {
        console.warn("[PhoneStream]", serial, "WS error", ev);
        onStatusRef.current?.("error");
        ws.close();
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafRef.current);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      const ws = wsRef.current;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      wsRef.current = null;
      pendingFrameRef.current?.close();
      pendingFrameRef.current = null;
      try {
        decoderRef.current?.close();
      } catch {}
      decoderRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relayWsUrl, initDecoder, renderLoop]);

  const toPhoneCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(((clientX - rect.left) / rect.width) * phoneRes.current.w),
      y: Math.round(((clientY - rect.top) / rect.height) * phoneRes.current.h),
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const { x, y } = toPhoneCoords(e.clientX, e.clientY);
      dragRef.current = { startX: x, startY: y, startTime: Date.now() };
    },
    [toPhoneCoords]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      const { x, y } = toPhoneCoords(e.clientX, e.clientY);
      const dx = Math.abs(x - drag.startX),
        dy = Math.abs(y - drag.startY);
      if (dx < 20 && dy < 20) sendCommand({ type: "tap", x, y });
      else
        sendCommand({
          type: "swipe",
          x: drag.startX,
          y: drag.startY,
          x2: x,
          y2: y,
          dur_ms: Math.min(Math.max(Date.now() - drag.startTime, 100), 1000),
        });
    },
    [toPhoneCoords, sendCommand]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const t = e.touches[0];
      if (!t) return;
      const { x, y } = toPhoneCoords(t.clientX, t.clientY);
      dragRef.current = { startX: x, startY: y, startTime: Date.now() };
    },
    [toPhoneCoords]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      const t = e.changedTouches[0];
      if (!t) return;
      const { x, y } = toPhoneCoords(t.clientX, t.clientY);
      const dx = Math.abs(x - drag.startX),
        dy = Math.abs(y - drag.startY);
      if (dx < 20 && dy < 20) sendCommand({ type: "tap", x, y });
      else
        sendCommand({
          type: "swipe",
          x: drag.startX,
          y: drag.startY,
          x2: x,
          y2: y,
          dur_ms: Math.min(Math.max(Date.now() - drag.startTime, 100), 1000),
        });
    },
    [toPhoneCoords, sendCommand]
  );

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={800}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        background: "#000",
        cursor: "crosshair",
        display: "block",
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
