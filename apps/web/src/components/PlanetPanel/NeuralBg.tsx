import { useEffect, useRef } from "react";

interface Props {
  serviceId: string;
  color: [number, number, number];
  exiting: boolean;
}

function rgb(r: number, g: number, b: number, a: number) {
  return `rgba(${r | 0},${g | 0},${b | 0},${a.toFixed(3)})`;
}
function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}
function _lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

interface Sphere {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
}

function buildSpheres(serviceId: string): Sphere[] {
  let s = serviceId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) | 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const spheres: Sphere[] = [];
  for (let i = 0; i < 8; i++) {
    spheres.push({
      x: 0.1 + rng() * 0.8,
      y: 0.1 + rng() * 0.8,
      vx: (rng() - 0.5) * 0.015,
      vy: (rng() - 0.5) * 0.015,
      r: 18 + rng() * 16,
      phase: rng() * Math.PI * 2,
    });
  }
  return spheres;
}

export function NeuralBg({ serviceId, color, exiting }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const opacityRef = useRef(0);
  const exitingRef = useRef(exiting);
  exitingRef.current = exiting;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const [cr, cg, cb] = color.map((c) => Math.round(c * 255));
    const br = Math.min(255, cr + 100);
    const bg = Math.min(255, cg + 100);
    const bb = Math.min(255, cb + 100);

    let W = 0,
      H = 0;
    const spheres = buildSpheres(serviceId);

    // Floating dust particles
    const dust: Dust[] = [];
    for (let i = 0; i < 40; i++) {
      dust.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.004,
        vy: (Math.random() - 0.5) * 0.004,
        size: 0.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const resize = () => {
      const parent = canvas.parentElement!;
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      W = canvas.width = parent.clientWidth * dpr;
      H = canvas.height = parent.clientHeight * dpr;
    };
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const t0 = Date.now();

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const time = (Date.now() - t0) / 1000;
      const dt = 1 / 60;

      const target = exitingRef.current ? 0 : 1;
      opacityRef.current += (target - opacityRef.current) * dt * 3;

      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = opacityRef.current;

      // ── Move spheres chaotically ──
      for (const sp of spheres) {
        // Drift + wobble
        sp.x += sp.vx * dt + Math.sin(time * 0.7 + sp.phase) * 0.0008;
        sp.y += sp.vy * dt + Math.cos(time * 0.5 + sp.phase * 1.3) * 0.0008;

        // Bounce off edges
        if (sp.x < 0.05) {
          sp.x = 0.05;
          sp.vx = Math.abs(sp.vx);
        }
        if (sp.x > 0.95) {
          sp.x = 0.95;
          sp.vx = -Math.abs(sp.vx);
        }
        if (sp.y < 0.05) {
          sp.y = 0.05;
          sp.vy = Math.abs(sp.vy);
        }
        if (sp.y > 0.95) {
          sp.y = 0.95;
          sp.vy = -Math.abs(sp.vy);
        }
      }

      // Absolute positions
      const abs = spheres.map((sp) => ({ x: sp.x * W, y: sp.y * H, r: sp.r, phase: sp.phase }));

      // ── Dynamic connections between nearby spheres ──
      const maxDist = Math.min(W, H) * 0.35;

      for (let i = 0; i < abs.length; i++) {
        for (let j = i + 1; j < abs.length; j++) {
          const a = abs[i],
            b = abs[j];
          const d = dist(a.x, a.y, b.x, b.y);
          if (d >= maxDist) continue;

          const strength = 1 - d / maxDist;
          const al = strength * 0.3;

          // Curved line
          const mx = (a.x + b.x) / 2,
            my = (a.y + b.y) / 2;
          const dx = b.x - a.x,
            dy = b.y - a.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = -dy / len,
            ny = dx / len;
          const curveAmt = Math.sin(time * 0.4 + i + j * 0.7) * 25 * strength;
          const cpx = mx + nx * curveAmt,
            cpy = my + ny * curveAmt;

          // Breathing line — opacity pulses slowly
          const breathe = 0.7 + 0.3 * Math.sin(time * 0.8 + i * 2 + j);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(cpx, cpy, b.x, b.y);
          ctx.strokeStyle = rgb(cr, cg, cb, al * breathe);
          ctx.lineWidth = 0.8 + strength;
          ctx.stroke();

          // Connection flash — bright glow at midpoint when spheres are very close
          if (strength > 0.7) {
            const flashA = ((strength - 0.7) / 0.3) * 0.4;
            const fg = ctx.createRadialGradient(cpx, cpy, 0, cpx, cpy, 30);
            fg.addColorStop(0, rgb(br, bg, bb, flashA * breathe));
            fg.addColorStop(0.4, rgb(cr, cg, cb, flashA * 0.3));
            fg.addColorStop(1, rgb(cr, cg, cb, 0));
            ctx.fillStyle = fg;
            ctx.beginPath();
            ctx.arc(cpx, cpy, 30, 0, Math.PI * 2);
            ctx.fill();
          }

          // Beam-shader style packets along the curve (like orbit particles)
          const beamSpeed = 1.2 + strength * 0.8;
          const beamDensity = 4;
          const steps = Math.max(20, Math.ceil(d / 4));
          for (let s = 0; s <= steps; s++) {
            const p = s / steps;
            // Position on quadratic bezier
            const px = (1 - p) ** 2 * a.x + 2 * (1 - p) * p * cpx + p ** 2 * b.x;
            const py = (1 - p) ** 2 * a.y + 2 * (1 - p) * p * cpy + p ** 2 * b.y;

            const wave = Math.sin(p * beamDensity - time * beamSpeed) * 0.5 + 0.5;
            const packet = wave ** 3;
            if (packet < 0.05) continue;

            const pa = packet * strength * 0.7;
            const glowR = 4 + packet * 12;

            // Glow
            const pg = ctx.createRadialGradient(px, py, 0, px, py, glowR);
            pg.addColorStop(0, rgb(br, bg, bb, pa * 0.6));
            pg.addColorStop(0.3, rgb(cr, cg, cb, pa * 0.2));
            pg.addColorStop(1, rgb(cr, cg, cb, 0));
            ctx.fillStyle = pg;
            ctx.beginPath();
            ctx.arc(px, py, glowR, 0, Math.PI * 2);
            ctx.fill();

            // Core
            if (packet > 0.3) {
              ctx.beginPath();
              ctx.arc(px, py, 1.5 + packet * 2, 0, Math.PI * 2);
              ctx.fillStyle = rgb(br, bg, bb, pa * 0.9);
              ctx.fill();
            }
          }
        }
      }

      // ── Draw spheres with glow ──
      for (const n of abs) {
        const pulse = 0.6 + Math.sin(time * 1.2 + n.phase) * 0.2;
        const breatheR = n.r * (1 + Math.sin(time * 0.8 + n.phase) * 0.1);

        // Wide glow
        const g1 = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, breatheR * 3);
        g1.addColorStop(0, rgb(cr, cg, cb, pulse * 0.3));
        g1.addColorStop(0.4, rgb(cr, cg, cb, pulse * 0.08));
        g1.addColorStop(1, rgb(cr, cg, cb, 0));
        ctx.fillStyle = g1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, breatheR * 3, 0, Math.PI * 2);
        ctx.fill();

        // Core
        const g2 = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, breatheR);
        g2.addColorStop(0, rgb(br, bg, bb, pulse * 0.7));
        g2.addColorStop(0.6, rgb(cr, cg, cb, pulse * 0.4));
        g2.addColorStop(1, rgb(cr, cg, cb, pulse * 0.1));
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, breatheR, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Floating dust particles ──
      for (const d of dust) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.x < 0) d.x = 1;
        if (d.x > 1) d.x = 0;
        if (d.y < 0) d.y = 1;
        if (d.y > 1) d.y = 0;

        const da = 0.15 + 0.1 * Math.sin(time * 1.5 + d.phase);
        ctx.beginPath();
        ctx.arc(d.x * W, d.y * H, d.size, 0, Math.PI * 2);
        ctx.fillStyle = rgb(cr, cg, cb, da);
        ctx.fill();
      }

      // ── Soft vignette ──
      const vig = ctx.createRadialGradient(
        W / 2,
        H / 2,
        Math.min(W, H) * 0.25,
        W / 2,
        H / 2,
        Math.max(W, H) * 0.6
      );
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.3)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      ctx.globalAlpha = 1;
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [serviceId, color]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 2,
      }}
    />
  );
}
