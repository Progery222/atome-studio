import { useCallback, useEffect, useRef } from "react";
import { NAL_TYPE, parseNalUnits, spsToCodecString } from "./h264-parser";

interface PhoneStreamProps {
  serial: string;
  host?: string;
  port?: number;
  orchestratorUrl?: string;
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
  const decoderRef = useRef<VideoDecoder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const tsRef = useRef<number>(0);
  const gotKeyRef = useRef<boolean>(false);
  const mountedRef = useRef(true);
  const dragRef = useRef<{ startX: number; startY: number; startTime: number } | null>(null);
  const phoneRes = useRef({ w: 720, h: 1600 });

  const relayWsUrl = (() => {
    if (host) return `ws://${host}:${port}/ws/stream/${serial}`;
    const isDev =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (isDev) return `ws://localhost:${port}/ws/stream/${serial}`;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/relay/ws/stream/${serial}`;
  })();

  const drawFrame = useCallback(
    (frame: VideoFrame) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        frame.close();
        return;
      }
      if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
        canvas.width = frame.displayWidth;
        canvas.height = frame.displayHeight;
      }
      phoneRes.current = { w: frame.displayWidth, h: frame.displayHeight };
      canvas.getContext("2d")?.drawImage(frame, 0, 0);
      frame.close();
      onStatus?.("streaming");
    },
    [onStatus]
  );

  const initDecoder = useCallback(
    (codec: string) => {
      try {
        decoderRef.current?.close();
      } catch {}
      gotKeyRef.current = false;

      if (typeof VideoDecoder === "undefined") return;

      const decoder = new VideoDecoder({
        output: drawFrame,
        error: (e) => {
          console.warn("[PhoneStream] decoder error:", e);
          if (mountedRef.current) setTimeout(() => initDecoder(codec), 300);
        },
      });

      try {
        (decoder as any).configure({
          codec,
          avc: { format: "annexb" },
          optimizeForLatency: true,
        });
        decoderRef.current = decoder;
      } catch (e) {
        console.warn("[PhoneStream] configure failed:", e);
      }
    },
    [drawFrame]
  );

  const sendCommand = useCallback((cmd: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(cmd));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    tsRef.current = 0;

    // Init decoder with baseline fallback codec
    initDecoder("avc1.42E01E");

    onStatus?.("connecting");
    const ws = new WebSocket(relayWsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      onStatus?.("connected");
    };

    ws.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;

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

      // On keyframe: reinit decoder with correct codec if needed
      if (hasIDR && detectedCodec) {
        initDecoder(detectedCodec);
        gotKeyRef.current = true;
      } else if (hasIDR) {
        gotKeyRef.current = true;
      }

      // Skip delta frames before first keyframe
      if (!hasIDR && !gotKeyRef.current) return;

      const decoder = decoderRef.current;
      if (!decoder || decoder.state !== "configured") return;

      try {
        decoder.decode(
          new EncodedVideoChunk({
            type: hasIDR ? "key" : "delta",
            timestamp: tsRef.current,
            data: event.data,
          })
        );
        tsRef.current += 33333;
      } catch (e) {
        console.warn("[PhoneStream] decode error:", e);
        if (detectedCodec) initDecoder(detectedCodec);
        else initDecoder("avc1.42E01E");
      }
    };

    ws.onclose = () => {
      onStatus?.("closed");
      if (mountedRef.current) {
        const t = setTimeout(() => {
          // reconnect handled by re-running this effect via serial change
          // simple reconnect:
          if (mountedRef.current && wsRef.current === ws) {
            wsRef.current = null;
            // trigger reconnect by re-running effect (no-op, just close cleanup)
          }
        }, 100);
        return () => clearTimeout(t);
      }
    };

    ws.onerror = () => {
      onStatus?.("error");
      ws.close();
    };

    return () => {
      mountedRef.current = false;
      ws.onclose = null;
      ws.close();
      wsRef.current = null;
      try {
        decoderRef.current?.close();
      } catch {}
      decoderRef.current = null;
    };
  }, [
    relayWsUrl,
    onStatus, // Init decoder with baseline fallback codec
    initDecoder,
  ]);

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
