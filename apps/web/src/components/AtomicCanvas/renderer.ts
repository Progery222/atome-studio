import { Service, OrbitConfig } from '@atome/shared'
import { buildGalaxy } from './galaxy'

export interface AtomHitTarget {
  service: Service
  x: number
  y: number
}

// ─── Renderer state ────────────────────────────────────────────────────────

interface RendererState {
  galCanvas: HTMLCanvasElement | null
  nucCanvas: HTMLCanvasElement | null
  nucBaseR: number
  angles: number[]
  pulseT: number
  offlineBlinkT: number
  time: number
  orbitTilts: number[]  // live tilt angles (drift over time)
}

const state: RendererState = {
  galCanvas: null,
  nucCanvas: null,
  nucBaseR: 0,
  angles: [],
  pulseT: 0,
  offlineBlinkT: 0,
  time: 0,
  orbitTilts: [],
}

// ─── Orbit rotation speeds (rad/frame) ──────────────────────────────────────

const ORBIT_ROTATION_SPEEDS = [0.0008, -0.0006, 0.0005]

// ─── Seeded RNG ────────────────────────────────────────────────────────────

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ─── Pre-render textured nucleus sphere ────────────────────────────────────

function buildNucleus(radius: number, dpr: number): HTMLCanvasElement {
  const pad = radius * 0.4
  const totalR = radius + pad
  const size = totalR * 2
  const nc = document.createElement('canvas')
  nc.width  = Math.ceil(size * dpr)
  nc.height = Math.ceil(size * dpr)
  const ctx = nc.getContext('2d')!
  ctx.scale(dpr, dpr)

  const cx = totalR
  const cy = totalR
  const r = radius
  const rng = seededRng(7)

  // ── Atmosphere glow (outside sphere boundary) ──
  const atmo = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.25)
  atmo.addColorStop(0,   'rgba(0, 190, 255, 0.22)')
  atmo.addColorStop(0.3, 'rgba(0, 140, 255, 0.10)')
  atmo.addColorStop(0.7, 'rgba(0, 80, 255, 0.03)')
  atmo.addColorStop(1,   'rgba(0, 40, 200, 0)')
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2)
  ctx.fillStyle = atmo
  ctx.fill()

  // ── Sphere body (clipped) ──
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()

  // Base gradient — deep blue sphere
  const base = ctx.createRadialGradient(cx - r * 0.1, cy - r * 0.1, 0, cx, cy, r)
  base.addColorStop(0,    '#c8e8ff')
  base.addColorStop(0.15, '#6eb8e8')
  base.addColorStop(0.4,  '#2080c0')
  base.addColorStop(0.7,  '#0a4a80')
  base.addColorStop(1,    '#021830')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  // Surface texture — subtle cloud-like patches
  for (let i = 0; i < 600; i++) {
    const px = cx + (rng() - 0.5) * r * 2.2
    const py = cy + (rng() - 0.5) * r * 2.2
    const pr = rng() * r * 0.25 + r * 0.02
    const isBright = rng() > 0.3

    ctx.beginPath()
    ctx.arc(px, py, pr, 0, Math.PI * 2)
    if (isBright) {
      const v = rng()
      ctx.fillStyle = `rgba(255, 255, 255, ${0.06 + v * 0.18})`
    } else {
      ctx.fillStyle = `rgba(80, 160, 255, ${0.04 + rng() * 0.12})`
    }
    ctx.fill()
  }

  // Subtle atmospheric bands
  for (let i = 0; i < 12; i++) {
    const bandY = cy - r + (r * 2 * (i + rng() * 0.5)) / 12
    const bandH = r * 0.08 + rng() * r * 0.05
    ctx.fillStyle = `rgba(160, 220, 255, ${0.03 + rng() * 0.06})`
    ctx.fillRect(cx - r, bandY, r * 2, bandH)
  }

  // Specular core flash
  const spotX = cx + r * 0.1
  const spotY = cy - r * 0.1
  const spotR = r * 0.35
  const spotG = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotR)
  spotG.addColorStop(0, 'rgba(255, 255, 255, 0.4)')
  spotG.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.beginPath()
  ctx.arc(spotX, spotY, spotR, 0, Math.PI * 2)
  ctx.fillStyle = spotG
  ctx.fill()

  ctx.restore() // un-clip

  // ── Rim light (bright cyan edge) ──
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  const rim = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r)
  rim.addColorStop(0,    'rgba(0, 0, 0, 0)')
  rim.addColorStop(0.75, 'rgba(0, 80, 180, 0.08)')
  rim.addColorStop(0.9,  'rgba(0, 160, 255, 0.22)')
  rim.addColorStop(1,    'rgba(0, 220, 255, 0.35)')
  ctx.fillStyle = rim
  ctx.fillRect(0, 0, size, size)
  ctx.restore()

  // ── Specular highlight (upper-left) ──
  const spec = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx - r * 0.2, cy - r * 0.2, r * 0.5)
  spec.addColorStop(0,   'rgba(210, 240, 255, 0.18)')
  spec.addColorStop(0.4, 'rgba(120, 200, 255, 0.08)')
  spec.addColorStop(1,   'rgba(0, 0, 0, 0)')
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = spec
  ctx.fill()

  return nc
}

// ─── Draw animated nucleus glow (pulsating, breathing) ─────────────────────

function drawNucleusGlow(
  ctx: CanvasRenderingContext2D,
  CX: number, CY: number,
  baseR: number, time: number,
) {
  // Gentle breathing pulse
  const breath1 = Math.sin(time * 1.5) * 0.06
  const breathScale = 1 + breath1
  const glowAlpha = 0.18 + 0.10 * Math.sin(time * 2.0)

  // Soft corona — cyan/blue
  const coronaR = baseR * 4.0 * breathScale
  const corona = ctx.createRadialGradient(CX, CY, baseR * 0.7, CX, CY, coronaR)
  corona.addColorStop(0,    `rgba(0, 200, 255, ${glowAlpha * 0.6})`)
  corona.addColorStop(0.2,  `rgba(0, 150, 255, ${glowAlpha * 0.3})`)
  corona.addColorStop(0.5,  `rgba(0, 80, 255, ${glowAlpha * 0.1})`)
  corona.addColorStop(1,    'rgba(0, 0, 0, 0)')
  ctx.beginPath()
  ctx.arc(CX, CY, coronaR, 0, Math.PI * 2)
  ctx.fillStyle = corona
  ctx.fill()

  // Soft inner halo
  const innerR = baseR * 2.0 * (1 + breath1 * 0.3)
  const innerAlpha = 0.30 + 0.12 * Math.sin(time * 2.5 + 0.5)
  const inner = ctx.createRadialGradient(CX, CY, baseR * 0.5, CX, CY, innerR)
  inner.addColorStop(0,   `rgba(200, 240, 255, ${innerAlpha * 0.5})`)
  inner.addColorStop(0.5, `rgba(80, 180, 255, ${innerAlpha * 0.2})`)
  inner.addColorStop(1,   'rgba(0, 0, 0, 0)')
  ctx.beginPath()
  ctx.arc(CX, CY, innerR, 0, Math.PI * 2)
  ctx.fillStyle = inner
  ctx.fill()
}

// ─── Draw one half of an orbit with animated energy pulses ─────────────────

const ARC_OVERLAP = 0.03
const PULSE_COUNT = 2     // energy pulses per orbit
const PULSE_SPEED = 0.18  // radians per second — slow, elegant

function drawOrbitHalf(
  ctx: CanvasRenderingContext2D,
  orbit: OrbitConfig,
  orbitIndex: number,
  CX: number, CY: number, SC: number,
  half: 'front' | 'back',
  time: number,
) {
  const startAngle = half === 'back'
    ? Math.PI - ARC_OVERLAP
    : -ARC_OVERLAP
  const endAngle = half === 'back'
    ? Math.PI * 2 + ARC_OVERLAP
    : Math.PI + ARC_OVERLAP

  const [r, g, b] = orbit.rgb.split(',').map(Number)
  const orbitR = orbit.a * SC

  // Use live tilt that rotates over time
  const liveTilt = state.orbitTilts[orbitIndex] ?? orbit.tilt

  ctx.save()
  ctx.translate(CX, CY)
  ctx.rotate(liveTilt)
  ctx.scale(1, orbit.b / orbit.a)
  ctx.lineCap = 'round'

  // Layer 1: wide soft glow around orbit
  ctx.beginPath()
  ctx.arc(0, 0, orbitR, startAngle, endAngle)
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.08)`
  ctx.lineWidth   = 18 * SC
  ctx.stroke()

  // Layer 2: medium glow
  ctx.beginPath()
  ctx.arc(0, 0, orbitR, startAngle, endAngle)
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.18)`
  ctx.lineWidth   = 6 * SC
  ctx.stroke()

  // Layer 3: core line — thick, visible
  ctx.beginPath()
  ctx.arc(0, 0, orbitR, startAngle, endAngle)
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.50)`
  ctx.lineWidth   = 2.5 * SC
  ctx.stroke()

  // ── Energy pulses — slow, smooth ──
  for (let p = 0; p < PULSE_COUNT; p++) {
    const pulseAngle = (time * PULSE_SPEED + (p * Math.PI * 2) / PULSE_COUNT) % (Math.PI * 2)

    const inBack  = pulseAngle >= Math.PI && pulseAngle <= Math.PI * 2
    const inFront = pulseAngle >= 0 && pulseAngle < Math.PI
    if ((half === 'back' && !inBack) || (half === 'front' && !inFront)) continue

    const px = Math.cos(pulseAngle) * orbitR
    const py = Math.sin(pulseAngle) * orbitR

    // Pulse glow
    const pulseR = 4 * SC
    const pg = ctx.createRadialGradient(px, py, 0, px, py, pulseR * 5)
    pg.addColorStop(0,   `rgba(${Math.min(255, r + 100)}, ${Math.min(255, g + 100)}, ${Math.min(255, b + 100)}, 0.85)`)
    pg.addColorStop(0.12,`rgba(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)}, 0.4)`)
    pg.addColorStop(0.35,`rgba(${r}, ${g}, ${b}, 0.10)`)
    pg.addColorStop(1,   'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.arc(px, py, pulseR * 5, 0, Math.PI * 2)
    ctx.fillStyle = pg
    ctx.fill()

    // Comet tail — smooth fade
    const tailLen = 0.45
    const steps = 16
    for (let s = 1; s <= steps; s++) {
      const frac = s / steps
      const ta = pulseAngle - tailLen * frac
      const tx = Math.cos(ta) * orbitR
      const ty = Math.sin(ta) * orbitR
      const tAlpha = 0.20 * (1 - frac) * (1 - frac) // quadratic fade
      const tSize  = pulseR * (1 - frac * 0.7)
      ctx.beginPath()
      ctx.arc(tx, ty, tSize, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${tAlpha})`
      ctx.fill()
    }
  }

  ctx.restore()
}

// ─── Draw a service sphere (metallic/glass look) ──────────────────────────

function drawSphere(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  svc: Service,
  depthScale: number,
  SC: number,
  highlightedId: string | null,
  orbits: OrbitConfig[],
) {
  const r = 16 * SC * depthScale  // slightly larger spheres
  const orbit = orbits[svc.oi] ?? orbits[0]
  const [or, og, ob] = orbit.rgb.split(',').map(Number)

  // Status-based color override
  let gr = or, gg = og, gb = ob
  if (svc.status === 'offline' || svc.status === 'error') {
    gr = 239; gg = 68; gb = 68
  } else if (svc.status === 'degraded') {
    gr = 251; gg = 191; gb = 36
  }

  const alpha = 0.5 + 0.5 * depthScale

  // ── Outer halo glow ──
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 4)
  halo.addColorStop(0,   `rgba(${gr}, ${gg}, ${gb}, ${0.40 * depthScale})`)
  halo.addColorStop(0.3, `rgba(${gr}, ${gg}, ${gb}, ${0.12 * depthScale})`)
  halo.addColorStop(0.6, `rgba(${gr}, ${gg}, ${gb}, ${0.03 * depthScale})`)
  halo.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.beginPath()
  ctx.arc(x, y, r * 4, 0, Math.PI * 2)
  ctx.fillStyle = halo
  ctx.fill()

  // ── Selection highlight ──
  if (svc.id === highlightedId) {
    ctx.beginPath()
    ctx.arc(x, y, r + 6 * SC, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(${gr}, ${gg}, ${gb}, 0.8)`
    ctx.lineWidth   = 2.5
    ctx.stroke()

    const selHalo = ctx.createRadialGradient(x, y, r, x, y, r * 5)
    selHalo.addColorStop(0, `rgba(${gr}, ${gg}, ${gb}, 0.25)`)
    selHalo.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.arc(x, y, r * 5, 0, Math.PI * 2)
    ctx.fillStyle = selHalo
    ctx.fill()
  }

  // ── Offline blink ──
  if (svc.status === 'offline' || svc.status === 'error') {
    const blink = 0.4 + 0.6 * Math.abs(Math.sin(state.offlineBlinkT))
    ctx.beginPath()
    ctx.arc(x, y, r + 3 * SC, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(239,68,68,${0.8 * blink})`
    ctx.lineWidth   = 2
    ctx.stroke()
  }

  // ── Sphere body — metallic gradient ──
  const bodyGrad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, 0, x, y, r)
  bodyGrad.addColorStop(0,    `rgba(${Math.min(255, gr + 100)}, ${Math.min(255, gg + 100)}, ${Math.min(255, gb + 100)}, ${alpha})`)
  bodyGrad.addColorStop(0.35, `rgba(${gr}, ${gg}, ${gb}, ${alpha * 0.9})`)
  bodyGrad.addColorStop(0.75, `rgba(${gr * 0.4 | 0}, ${gg * 0.4 | 0}, ${gb * 0.4 | 0}, ${alpha * 0.85})`)
  bodyGrad.addColorStop(1,    `rgba(${gr * 0.15 | 0}, ${gg * 0.15 | 0}, ${gb * 0.15 | 0}, ${alpha * 0.6})`)
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = bodyGrad
  ctx.fill()

  // ── Specular highlight (upper-left bright spot) ──
  const specGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x - r * 0.15, y - r * 0.15, r * 0.55)
  specGrad.addColorStop(0,   `rgba(255, 255, 255, ${0.65 * depthScale})`)
  specGrad.addColorStop(0.3, `rgba(255, 255, 255, ${0.2 * depthScale})`)
  specGrad.addColorStop(1,   'rgba(255, 255, 255, 0)')
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = specGrad
  ctx.fill()

  // ── Rim light (edge glow) ──
  const rimGrad = ctx.createRadialGradient(x, y, r * 0.6, x, y, r)
  rimGrad.addColorStop(0,   'rgba(0, 0, 0, 0)')
  rimGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0)')
  rimGrad.addColorStop(1,   `rgba(${Math.min(255, gr + 60)}, ${Math.min(255, gg + 60)}, ${Math.min(255, gb + 60)}, ${0.15 * depthScale})`)
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = rimGrad
  ctx.fill()
}

// ─── Public API ────────────────────────────────────────────────────────────

export function resetGalaxy() {
  state.galCanvas = null
  state.nucCanvas = null
}

export function initAngles(services: Service[]) {
  if (state.angles.length !== services.length) {
    state.angles = services.map((s) => s.a)
  }
}

export function render(
  canvas: HTMLCanvasElement,
  services: Service[],
  orbits: OrbitConfig[],
  highlightedId: string | null,
  dpr: number,
  zoom: number = 1,
): AtomHitTarget[] {
  const W  = canvas.clientWidth
  const H  = canvas.clientHeight
  const CX = W * 0.5
  const CY = H * 0.5
  const SC = Math.min(W, H) / 900 * zoom

  const ctx = canvas.getContext('2d')!

  // Resize canvas if needed
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width  = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    ctx.scale(dpr, dpr)
    state.galCanvas = null
    state.nucCanvas = null
  }

  // Build galaxy background once per resize
  if (!state.galCanvas) {
    state.galCanvas = buildGalaxy(W, H, dpr)
  }
  ctx.drawImage(state.galCanvas, 0, 0, W, H)

  state.pulseT        += 0.010
  state.offlineBlinkT += 0.07
  state.time          += 0.016  // ~60fps time step

  // ── Init orbit tilts from config ──
  if (state.orbitTilts.length !== orbits.length) {
    state.orbitTilts = orbits.map((o) => o.tilt)
  }

  // ── Advance orbit tilt rotation ──
  for (let i = 0; i < orbits.length; i++) {
    state.orbitTilts[i] += ORBIT_ROTATION_SPEEDS[i] ?? 0.0005
  }

  // ── Nucleus metrics ──
  const baseNR = 85 * SC
  const pulse  = 1 + 0.06 * Math.sin(state.pulseT * 2.5)

  // Build nucleus texture once per resize/zoom
  if (!state.nucCanvas || Math.abs(state.nucBaseR - baseNR) > 1) {
    state.nucBaseR = baseNR
    state.nucCanvas = buildNucleus(baseNR, dpr)
  }

  // ── Compute sphere positions & advance angles ──
  const items = services.map((svc, i) => {
    const orbit = orbits[svc.oi] ?? orbits[0]
    const angle = state.angles[i] ?? svc.a
    const liveTilt = state.orbitTilts[svc.oi] ?? orbit.tilt

    const cosA = Math.cos(angle)
    const sinA = Math.sin(angle)
    const cosT = Math.cos(liveTilt)
    const sinT = Math.sin(liveTilt)
    const ex   = orbit.a * SC * cosA
    const ey   = orbit.b * SC * sinA
    const x    = CX + ex * cosT - ey * sinT
    const y    = CY + ex * sinT + ey * cosT

    // depth: positive = behind nucleus, negative = in front
    const depth      = -sinA
    const depthScale = 0.55 + 0.45 * ((sinA + 1) / 2)

    // Advance angle
    state.angles[i] = angle + svc.spd

    return { svc, x, y, depth, depthScale, i }
  })

  // Sort back-to-front
  const sorted = [...items].sort((a, b) => b.depth - a.depth)

  // ── 1. BACK halves of orbits ──
  orbits.forEach((orbit, idx) => {
    drawOrbitHalf(ctx, orbit, idx, CX, CY, SC, 'back', state.time)
  })

  // ── 2. Spheres BEHIND nucleus ──
  const hits: AtomHitTarget[] = []
  for (const item of sorted) {
    if (item.depth > 0.1) {
      drawSphere(ctx, item.x, item.y, item.svc, item.depthScale, SC, highlightedId, orbits)
      hits.push({ service: item.svc, x: item.x, y: item.y })
    }
  }

  // ── 3. Animated nucleus glow ──
  drawNucleusGlow(ctx, CX, CY, baseNR, state.time)

  // ── 4. Nucleus sphere (rotating) ──
  const drawNR  = baseNR * pulse
  const nucDrawSize = drawNR * 2.8

  ctx.save()
  ctx.translate(CX, CY)
  ctx.rotate(state.time * 0.15) // slow majestic rotation of the core
  ctx.drawImage(
    state.nucCanvas!,
    -nucDrawSize / 2,
    -nucDrawSize / 2,
    nucDrawSize,
    nucDrawSize,
  )
  ctx.restore()

  // ── 5. FRONT halves of orbits ──
  orbits.forEach((orbit, idx) => {
    drawOrbitHalf(ctx, orbit, idx, CX, CY, SC, 'front', state.time)
  })

  // ── 6. Spheres IN FRONT of nucleus ──
  for (const item of sorted) {
    if (item.depth <= 0.1) {
      drawSphere(ctx, item.x, item.y, item.svc, item.depthScale, SC, highlightedId, orbits)
      hits.push({ service: item.svc, x: item.x, y: item.y })
    }
  }

  return hits
}
