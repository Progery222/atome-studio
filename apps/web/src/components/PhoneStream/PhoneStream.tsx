import { useCallback, useEffect, useRef } from "react";
import { NAL_TYPE, parseNalUnits, spsToCodecString } from "./h264-parser";

const MAX_DECODE_QUEUE = 3;

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
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const decoderRef = useRef<VideoDecoder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const tsRef = useRef<number>(0);
  const gotKeyRef = useRef<boolean>(false);
  const mountedRef = useRef(true);
  const codecRef = useRef<string>("");
  const pendingFrameRef = useRef<VideoFrame | null>(null);
  const rafRef = useRef<number>(0);
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

  // Fix #2: render loop via requestAnimationFrame instead of sync drawImage
  const renderLoop = useCallback(() => {
    const frame = pendingFrameRef.current;
    if (frame) {
      pendingFrameRef.current = null;
      const canvas = canvasRef.current;
      if (canvas) {
        if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
          canvas.width = frame.displayWidth;
          canvas.height = frame.displayHeight;
          // Fix #3: cache context, re-acquire only on resize
          ctxRef.current = canvas.getContext("2d");
        }
        phoneRes.current = { w: frame.displayWidth, h: frame.displayHeight };
        ctxRef.current?.drawImage(frame, 0, 0);
        onStatus?.("streaming");
      }
      frame.close();
    }
    if (mountedRef.current) {
      rafRef.current = requestAnimationFrame(renderLoop);
    }
  }, [onStatus]);

  const initDecoder = useCallback(
    (codec: string) => {
      try {
        decoderRef.current?.close();
      } catch {}
      gotKeyRef.current = false;
      codecRef.current = codec;

      if (typeof VideoDecoder === "undefined") return;

      const decoder = new VideoDecoder({
        // Fix #2: decoder output goes to pending frame ref, not direct draw
        output: (frame) => {
          // drop previous undisplayed frame to avoid memory buildup
          pendingFrameRef.current?.close();
          pendingFrameRef.current = frame;
        },
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
    [],
  );

  const sendCommand = useCallback((cmd: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(cmd));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    tsRef.current = 0;

    // Fix #3: cache canvas context once
    if (canvasRef.current) {
      ctxRef.current = canvasRef.current.getContext("2d");
    }

    // Init decoder with baseline fallback codec
    initDecoder("avc1.42E01E");

    // Start render loop
    rafRef.current = requestAnimationFrame(renderLoop);

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

      // Fix #1: only reinit decoder if codec string actually changed
      if (hasIDR && detectedCodec && detectedCodec !== codecRef.current) {
        initDecoder(detectedCodec);
        gotKeyRef.current = true;
      } else if (hasIDR) {
        gotKeyRef.current = true;
      }

      // Skip delta frames before first keyframe
      if (!hasIDR && !gotKeyRef.current) return;

      const decoder = decoderRef.current;
      if (!decoder || decoder.state !== "configured") return;

      // Fix #4: drop frames if decode queue is backed up
      if (decoder.decodeQueueSize > MAX_DECODE_QUEUE) return;

      try {
        decoder.decode(
          new EncodedVideoChunk({
            type: hasIDR ? "key" : "delta",
            timestamp: tsRef.current,
            data: event.data,
          })
        );
        // Fix #5: 66666μs (~15fps) matches real videorecorder FPS
        tsRef.current += 66666;
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
          if (mountedRef.current && wsRef.current === ws) {
            wsRef.current = null;
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
      cancelAnimationFrame(rafRef.current);
      ws.onclose = null;
      ws.close();
      wsRef.current = null;
      pendingFrameRef.current?.close();
      pendingFrameRef.current = null;
      try {
        decoderRef.current?.close();
      } catch {}
      decoderRef.current = null;
    };
  }, [relayWsUrl, onStatus, initDecoder, renderLoop]);

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
