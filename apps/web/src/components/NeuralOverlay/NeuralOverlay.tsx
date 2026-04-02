import { useEffect, useRef } from 'react'

/**
 * Permanent subtle neural network on the galaxy background.
 * Adapted from neural-interface.html — particles on tilted orbits
 * with neural threads between nearby particles. Very subdued.
 */

const COLORS: [number, number, number][] = [
  [40, 90, 200],   // blue
  [110, 50, 200],  // violet
  [40, 170, 210],  // cyan
  [160, 35, 210],  // purple
  [20, 140, 210],  // teal
  [140, 60, 210],  // lavender
]

function rgb(r: number, g: number, b: number, a: number) {
  return `rgba(${r | 0},${g | 0},${b | 0},${a.toFixed(3)})`
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
}

interface Particle {
  angle: number
  orbitIdx: number
  size: number
  pulsePhase: number
  pulseSpeed: number
  x: number; y: number
}

interface Orbit {
  radius: number
  tiltX: number
  tiltY: number
  speed: number
  colorIdx: number
}

const ORBIT_PARAMS = [
  { r: 0.18, tx: 0.3,  ty: 0.1,  s: 0.15, ci: 0 },
  { r: 0.28, tx: -0.2, ty: 0.35, s: -0.12, ci: 1 },
  { r: 0.36, tx: 0.35, ty: -0.18, s: 0.10, ci: 2 },
  { r: 0.46, tx: 0.1,  ty: 0.4,  s: -0.08, ci: 3 },
  { r: 0.56, tx: -0.3, ty: 0.15, s: 0.07,  ci: 4 },
  { r: 0.68, tx: 0.2,  ty: -0.25, s: -0.05, ci: 5 },
]

const PARTICLES_PER_ORBIT = [5, 6, 5, 4, 4, 3]

export function NeuralOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    let W = 0, H = 0, cx = 0, cy = 0

    const resize = () => {
      const parent = canvas.parentElement!
      W = canvas.width = parent.clientWidth
      H = canvas.height = parent.clientHeight
      cx = W / 2
      cy = H / 2
      // Rebuild orbits with new dimensions
      orbits.length = 0
      ORBIT_PARAMS.forEach(p => {
        orbits.push({
          radius: Math.min(W, H) * p.r,
          tiltX: p.tx, tiltY: p.ty,
          speed: p.s, colorIdx: p.ci,
        })
      })
    }

    const orbits: Orbit[] = []
    const particles: Particle[] = []

    // Init particles
    const initParticles = () => {
      particles.length = 0
      ORBIT_PARAMS.forEach((_, oi) => {
        for (let i = 0; i < PARTICLES_PER_ORBIT[oi]; i++) {
          particles.push({
            angle: (i / PARTICLES_PER_ORBIT[oi]) * Math.PI * 2,
            orbitIdx: oi,
            size: 2.5 + Math.random() * 3,
            pulsePhase: Math.random() * Math.PI * 2,
            pulseSpeed: 1 + Math.random() * 1.5,
            x: 0, y: 0,
          })
        }
      })
    }

    resize()
    initParticles()
    window.addEventListener('resize', () => { resize(); initParticles() })

    const startTime = Date.now()

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      const time = (Date.now() - startTime) / 1000

      ctx.clearRect(0, 0, W, H)

      // ── Update particles first ──
      for (const p of particles) {
        const orbit = orbits[p.orbitIdx]
        if (!orbit) continue
        p.angle += orbit.speed * 0.016
        p.pulsePhase += p.pulseSpeed * 0.016

        const pulse = 0.03 * Math.sin(p.pulsePhase)
        const r = orbit.radius * (1 + pulse)
        const x3d = Math.cos(p.angle) * r
        const y3d = Math.sin(p.angle) * r
        p.x = cx + x3d
        p.y = cy + y3d + x3d * orbit.tiltX + y3d * orbit.tiltY
      }

      // ── Neural threads between nearby particles ──
      const maxDist = Math.min(W, H) * 0.3
      const spike = Math.pow(0.5 + 0.5 * Math.sin(time * 1.5), 2)

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const d = dist(a.x, a.y, b.x, b.y)

          if (d < maxDist) {
            const strength = 1 - d / maxDist
            const alpha = strength * 0.3 * spike
            const c1 = COLORS[orbits[a.orbitIdx]?.colorIdx ?? 0]
            const c2 = COLORS[orbits[b.orbitIdx]?.colorIdx ?? 0]
            const c: [number, number, number] = [
              lerp(c1[0], c2[0], 0.5),
              lerp(c1[1], c2[1], 0.5),
              lerp(c1[2], c2[2], 0.5),
            ]

            // Thread line
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = rgb(c[0], c[1], c[2], alpha)
            ctx.lineWidth = 0.5 + strength
            ctx.stroke()

            // Traveling impulse
            if (strength > 0.25) {
              const impulseT = (time * 0.8 + i * 0.7 + j * 0.3) % 1
              const ix = lerp(a.x, b.x, impulseT)
              const iy = lerp(a.y, b.y, impulseT)
              const iAlpha = alpha * 2.5 * (1 - Math.abs(impulseT - 0.5) * 2)

              const ig = ctx.createRadialGradient(ix, iy, 0, ix, iy, 5)
              ig.addColorStop(0, rgb(Math.min(255, c[0] + 80), Math.min(255, c[1] + 80), Math.min(255, c[2] + 80), iAlpha))
              ig.addColorStop(0.4, rgb(c[0], c[1], c[2], iAlpha * 0.4))
              ig.addColorStop(1, rgb(c[0], c[1], c[2], 0))
              ctx.fillStyle = ig
              ctx.beginPath()
              ctx.arc(ix, iy, 5, 0, Math.PI * 2)
              ctx.fill()
            }
          }
        }
      }

      // ── Draw particles (very small, subtle) ──
      for (const p of particles) {
        const orbit = orbits[p.orbitIdx]
        if (!orbit) continue
        const c = COLORS[orbit.colorIdx % COLORS.length]
        const pulseVal = 0.4 + 0.3 * Math.sin(p.pulsePhase)
        const sz = p.size * (0.7 + pulseVal * 0.4)

        // Soft glow
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * 3)
        glow.addColorStop(0, rgb(c[0], c[1], c[2], 0.5 * pulseVal))
        glow.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, sz * 3, 0, Math.PI * 2)
        ctx.fill()

        // Core
        ctx.beginPath()
        ctx.arc(p.x, p.y, sz * 0.6, 0, Math.PI * 2)
        ctx.fillStyle = rgb(
          Math.min(255, c[0] + 60),
          Math.min(255, c[1] + 60),
          Math.min(255, c[2] + 60),
          0.7 * pulseVal
        )
        ctx.fill()
      }
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
        opacity: 1,
      }}
    />
  )
}
