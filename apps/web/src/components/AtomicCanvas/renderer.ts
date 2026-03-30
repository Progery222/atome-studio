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
}

const state: RendererState = {
  galCanvas: null,
  nucCanvas: null,
  nucBaseR: 0,
  angles: [],
  pulseT: 0,
  offlineBlinkT: 0,
}

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
  const atmo = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.35)
  atmo.addColorStop(0,   'rgba(0, 190, 255, 0.45)')
  atmo.addColorStop(0.3, 'rgba(0, 140, 255, 0.18)')
  atmo.addColorStop(0.7, 'rgba(0, 80, 255, 0.05)')
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

  // Base gradient — deep blue planet
  const base = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx + r * 0.1, cy + r * 0.1, r * 1.1)
  base.addColorStop(0,    '#2a6fa0')
  base.addColorStop(0.25, '#1d5580')
  base.addColorStop(0.5,  '#123c5c')
  base.addColorStop(0.8,  '#0a2438')
  base.addColorStop(1,    '#061620')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  // Surface noise — lighter/darker patches for texture
  for (let i = 0; i < 500; i++) {
    const px = cx + (rng() - 0.5) * r * 2.2
    const py = cy + (rng() - 0.5) * r * 2.2
    const pr = rng() * r * 0.18 + r * 0.02
    const isBright = rng() > 0.4

    ctx.beginPath()
    ctx.arc(px, py, pr, 0, Math.PI * 2)
    if (isBright) {
      const v = rng()
      ctx.fillStyle = `rgba(${30 + v * 40 | 0}, ${100 + v * 60 | 0}, ${160 + v * 50 | 0}, ${0.04 + rng() * 0.08})`
    } else {
      ctx.fillStyle = `rgba(0, ${10 + rng() * 20 | 0}, ${25 + rng() * 25 | 0}, ${0.05 + rng() * 0.1})`
    }
    ctx.fill()
  }

  // Subtle horizontal bands (gas giant feel)
  for (let i = 0; i < 8; i++) {
    const bandY = cy - r + (r * 2 * (i + rng() * 0.5)) / 8
    const bandH = r * 0.04 + rng() * r * 0.04
    ctx.fillStyle = `rgba(${15 + rng() * 25 | 0}, ${50 + rng() * 40 | 0}, ${100 + rng() * 50 | 0}, ${0.03 + rng() * 0.05})`
    ctx.fillRect(cx - r, bandY, r * 2, bandH)
  }

  // Dark spot accent
  const spotX = cx + r * 0.15
  const spotY = cy + r * 0.05
  const spotR = r * 0.08
  const spotG = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotR)
  spotG.addColorStop(0, 'rgba(80, 30, 20, 0.12)')
  spotG.addColorStop(1, 'rgba(0, 0, 0, 0)')
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
  rim.addColorStop(0.75, 'rgba(0, 80, 180, 0.06)')
  rim.addColorStop(0.9,  'rgba(0, 160, 255, 0.18)')
  rim.addColorStop(1,    'rgba(0, 220, 255, 0.3)')
  ctx.fillStyle = rim
  ctx.fillRect(0, 0, size, size)
  ctx.restore()

  // ── Specular highlight (upper-left) ──
  const spec = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx - r * 0.2, cy - r * 0.2, r * 0.5)
  spec.addColorStop(0,   'rgba(210, 240, 255, 0.15)')
  spec.addColorStop(0.4, 'rgba(120, 200, 255, 0.06)')
  spec.addColorStop(1,   'rgba(0, 0, 0, 0)')
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = spec
  ctx.fill()

  return nc
}

// ─── Draw one half (front / back) of an orbit ellipse ──────────────────────

const ARC_OVERLAP = 0.03 // small overlap to prevent seam gaps

function drawOrbitHalf(
  ctx: CanvasRenderingContext2D,
  orbit: OrbitConfig,
  CX: number, CY: number, SC: number,
  half: 'front' | 'back',
) {
  // back = top semicircle (π → 2π), front = bottom semicircle (0 → π)
  const startAngle = half === 'back'
    ? Math.PI - ARC_OVERLAP
    : -ARC_OVERLAP
  const endAngle = half === 'back'
    ? Math.PI * 2 + ARC_OVERLAP
    : Math.PI + ARC_OVERLAP

  const [r, g, b] = orbit.rgb.split(',').map(Number)

  ctx.save()
  ctx.translate(CX, CY)
  ctx.rotate(orbit.tilt)
  ctx.scale(1, orbit.b / orbit.a)

  // Wide soft outer glow
  ctx.beginPath()
  ctx.arc(0, 0, orbit.a * SC, startAngle, endAngle)
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.10)`
  ctx.lineWidth   = 16 * SC
  ctx.lineCap     = 'butt'
  ctx.stroke()

  // Medium glow
  ctx.beginPath()
  ctx.arc(0, 0, orbit.a * SC, startAngle, endAngle)
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.22)`
  ctx.lineWidth   = 5 * SC
  ctx.stroke()

  // Bright core line
  ctx.beginPath()
  ctx.arc(0, 0, orbit.a * SC, startAngle, endAngle)
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.55)`
  ctx.lineWidth   = 1.8 * SC
  ctx.stroke()

  // Extra bright highlight
  ctx.beginPath()
  ctx.arc(0, 0, orbit.a * SC, startAngle, endAngle)
  ctx.strokeStyle = `rgba(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)}, 0.25)`
  ctx.lineWidth   = 0.7 * SC
  ctx.stroke()

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
  const r = 13 * SC * depthScale
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
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5)
  halo.addColorStop(0,   `rgba(${gr}, ${gg}, ${gb}, ${0.35 * depthScale})`)
  halo.addColorStop(0.4, `rgba(${gr}, ${gg}, ${gb}, ${0.08 * depthScale})`)
  halo.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.beginPath()
  ctx.arc(x, y, r * 3.5, 0, Math.PI * 2)
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
): AtomHitTarget[] {
  const W  = canvas.clientWidth
  const H  = canvas.clientHeight
  const CX = W * 0.5
  const CY = H * 0.5
  const SC = Math.min(W, H) / 900

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

  // ── Nucleus metrics ──
  const baseNR = 85 * SC
  const pulse  = 1 + 0.02 * Math.sin(state.pulseT)

  // Build nucleus texture once per resize
  if (!state.nucCanvas || Math.abs(state.nucBaseR - baseNR) > 1) {
    state.nucBaseR = baseNR
    state.nucCanvas = buildNucleus(baseNR, dpr)
  }

  // ── Compute sphere positions & advance angles ──
  const items = services.map((svc, i) => {
    const orbit = orbits[svc.oi] ?? orbits[0]
    const angle = state.angles[i] ?? svc.a

    const cosA = Math.cos(angle)
    const sinA = Math.sin(angle)
    const cosT = Math.cos(orbit.tilt)
    const sinT = Math.sin(orbit.tilt)
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

  // Sort back-to-front (most positive depth → drawn first, painted over later)
  const sorted = [...items].sort((a, b) => b.depth - a.depth)

  // ────────────────────────────────────────────────────────────────────────
  // RENDERING ORDER: back orbits → back spheres → nucleus → front orbits → front spheres
  // This gives proper 3D depth with orbits passing behind and in front of the nucleus.
  // ────────────────────────────────────────────────────────────────────────

  // ── 1. BACK halves of orbits (top semicircle — behind nucleus) ──
  orbits.forEach((orbit) => {
    drawOrbitHalf(ctx, orbit, CX, CY, SC, 'back')
  })

  // ── 2. Spheres BEHIND nucleus ──
  const hits: AtomHitTarget[] = []
  for (const item of sorted) {
    if (item.depth > 0.1) {
      drawSphere(ctx, item.x, item.y, item.svc, item.depthScale, SC, highlightedId, orbits)
      hits.push({ service: item.svc, x: item.x, y: item.y })
    }
  }

  // ── 3. Nucleus corona (outer volumetric glow) ──
  const drawNR  = baseNR * pulse
  const coronaR = drawNR * 5
  const corona  = ctx.createRadialGradient(CX, CY, drawNR * 0.6, CX, CY, coronaR)
  corona.addColorStop(0,    'rgba(0, 200, 255, 0.3)')
  corona.addColorStop(0.15, 'rgba(0, 150, 255, 0.1)')
  corona.addColorStop(0.4,  'rgba(0, 100, 255, 0.03)')
  corona.addColorStop(1,    'rgba(0, 0, 0, 0)')
  ctx.beginPath()
  ctx.arc(CX, CY, coronaR, 0, Math.PI * 2)
  ctx.fillStyle = corona
  ctx.fill()

  // ── 4. Nucleus sphere ──
  const nucDrawSize = drawNR * 2.8
  ctx.drawImage(
    state.nucCanvas!,
    CX - nucDrawSize / 2,
    CY - nucDrawSize / 2,
    nucDrawSize,
    nucDrawSize,
  )

  // ── 5. FRONT halves of orbits (bottom semicircle — in front of nucleus) ──
  orbits.forEach((orbit) => {
    drawOrbitHalf(ctx, orbit, CX, CY, SC, 'front')
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
