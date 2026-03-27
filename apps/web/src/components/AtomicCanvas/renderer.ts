import { Service, OrbitConfig } from '@atome/shared'
import { buildGalaxy } from './galaxy'

export interface AtomHitTarget {
  service: Service
  x: number
  y: number
}

interface RendererState {
  galCanvas: HTMLCanvasElement | null
  angles: number[]
  pulseT: number
  offlineBlinkT: number
}

const state: RendererState = {
  galCanvas: null,
  angles: [],
  pulseT: 0,
  offlineBlinkT: 0,
}

export function resetGalaxy() {
  state.galCanvas = null
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
  const W = canvas.clientWidth
  const H = canvas.clientHeight
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
  }

  // Build galaxy once per resize
  if (!state.galCanvas) {
    state.galCanvas = buildGalaxy(W, H, dpr)
  }
  ctx.drawImage(state.galCanvas, 0, 0, W, H)

  state.pulseT      += 0.012
  state.offlineBlinkT += 0.08

  // Sort services by depth (y in orbit-space) for 3D layering
  const sorted = services.map((svc, i) => {
    const orbit   = orbits[svc.oi] ?? orbits[0]
    const angle   = state.angles[i] ?? svc.a
    const cosA    = Math.cos(angle)
    const sinA    = Math.sin(angle)
    const cosT    = Math.cos(orbit.tilt)
    const sinT    = Math.sin(orbit.tilt)
    const ex      = orbit.a * SC * cosA
    const ey      = orbit.b * SC * sinA
    const x       = CX + ex * cosT - ey * sinT
    const y       = CY + ex * sinT + ey * cosT
    const depth   = Math.sin(angle - orbit.tilt)
    const depthScale = 0.55 + 0.45 * ((depth + 1) / 2)
    return { svc, x, y, depth, depthScale, i }
  }).sort((a, b) => a.depth - b.depth)

  // Draw orbits
  orbits.forEach((orbit) => {
    ctx.save()
    ctx.translate(CX, CY)
    ctx.rotate(orbit.tilt)
    ctx.scale(1, orbit.b / orbit.a)
    ctx.beginPath()
    ctx.arc(0, 0, orbit.a * SC, 0, Math.PI * 2)
    ctx.restore()
    ctx.strokeStyle = `rgba(${orbit.rgb},0.25)`
    ctx.lineWidth   = 0.5
    ctx.setLineDash([4, 8])
    ctx.stroke()
    ctx.setLineDash([])
  })

  // Draw nucleus
  const pulse = 1 + 0.08 * Math.sin(state.pulseT)
  const nr    = 22 * SC * pulse
  const ng    = ctx.createRadialGradient(CX, CY, 0, CX, CY, nr * 2.2)
  ng.addColorStop(0,   'rgba(255,255,255,0.95)')
  ng.addColorStop(0.12,'rgba(200,230,255,0.85)')
  ng.addColorStop(0.35,'rgba(80,160,255,0.55)')
  ng.addColorStop(0.65,'rgba(20,80,180,0.25)')
  ng.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.beginPath()
  ctx.arc(CX, CY, nr * 2.2, 0, Math.PI * 2)
  ctx.fillStyle = ng
  ctx.fill()

  // Nucleus glow rings
  for (let gi = 0; gi < 4; gi++) {
    const gr  = nr * (1.5 + gi * 0.9)
    const ga  = 0.07 - gi * 0.015
    ctx.beginPath()
    ctx.arc(CX, CY, gr, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(80,160,255,${ga})`
    ctx.lineWidth   = 1.5 - gi * 0.3
    ctx.stroke()
  }

  const hits: AtomHitTarget[] = []

  // Draw atoms back-to-front
  sorted.forEach(({ svc, x, y, depthScale, i }) => {
    const r = 7 * SC * depthScale
    const [cr, cg, cb] = svc.col
    const alpha = 0.45 + 0.55 * depthScale

    // Advance angle
    state.angles[i] = (state.angles[i] ?? svc.a) + svc.spd

    // Highlight ring
    if (svc.id === highlightedId) {
      ctx.beginPath()
      ctx.arc(x, y, r + 5, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.8)`
      ctx.lineWidth   = 1.5
      ctx.stroke()
    }

    // Offline blink
    if (svc.status === 'offline' || svc.status === 'error') {
      const blink = 0.4 + 0.6 * Math.abs(Math.sin(state.offlineBlinkT))
      ctx.beginPath()
      ctx.arc(x, y, r + 4, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(239,68,68,${0.18 * blink})`
      ctx.fill()
    }

    // Atom glow
    ctx.shadowBlur  = 10 * depthScale
    ctx.shadowColor = `rgba(${cr},${cg},${cb},0.7)`

    // Atom fill
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r)
    grad.addColorStop(0, `rgba(${Math.min(cr+80,255)},${Math.min(cg+80,255)},${Math.min(cb+80,255)},${alpha})`)
    grad.addColorStop(1, `rgba(${cr},${cg},${cb},${alpha * 0.6})`)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()

    ctx.shadowBlur  = 0
    ctx.shadowColor = 'transparent'

    hits.push({ service: svc, x, y })
  })

  return hits
}
