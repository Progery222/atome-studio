/**
 * Builds and caches the static galaxy background.
 * Visual reference: Deep space with bright volumetric god rays and subtle stars.
 */

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function buildGalaxy(w: number, h: number, dpr: number): HTMLCanvasElement {
  const gc = document.createElement('canvas')
  gc.width  = Math.ceil(w * dpr)
  gc.height = Math.ceil(h * dpr)
  const ctx = gc.getContext('2d')!
  ctx.scale(dpr, dpr)

  const rng = seededRng(42)
  const CX = w * 0.5
  const CY = h * 0.5

  // 1. Deep black/navy background
  const bg = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(w, h) * 0.7)
  bg.addColorStop(0,   '#030a14')
  bg.addColorStop(0.5, '#010508')
  bg.addColorStop(1,   '#000002')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // 2. Subtle blue ambient haze near center
  const haze = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(w, h) * 0.45)
  haze.addColorStop(0,   'rgba(0, 80, 180, 0.12)')
  haze.addColorStop(0.3, 'rgba(0, 50, 120, 0.05)')
  haze.addColorStop(0.7, 'rgba(0, 20, 60, 0.015)')
  haze.addColorStop(1,   'rgba(0, 0, 0, 0)')
  ctx.fillStyle = haze
  ctx.fillRect(0, 0, w, h)

  // 3. Bright volumetric god rays (starburst from center)
  ctx.save()
  ctx.translate(CX, CY)
  const rayCount = 90
  for (let i = 0; i < rayCount; i++) {
    const angle = (Math.PI * 2 * i) / rayCount + (rng() - 0.5) * 0.06
    const length = Math.max(w, h) * (0.3 + rng() * 0.5)
    const thickness = 1.5 + rng() * 12
    const brightness = 0.04 + rng() * 0.09

    ctx.save()
    ctx.rotate(angle)

    const ray = ctx.createLinearGradient(0, 0, length, 0)
    ray.addColorStop(0,   `rgba(220, 245, 255, ${brightness * 2.2})`)
    ray.addColorStop(0.08, `rgba(150, 220, 255, ${brightness * 1.4})`)
    ray.addColorStop(0.3,  `rgba(0, 140, 255, ${brightness * 0.6})`)
    ray.addColorStop(0.7,  `rgba(0, 60, 200, ${brightness * 0.15})`)
    ray.addColorStop(1,    'rgba(0, 30, 120, 0)')

    ctx.beginPath()
    ctx.moveTo(0, -thickness / 2)
    ctx.lineTo(length, 0)
    ctx.lineTo(0, thickness / 2)
    ctx.fillStyle = ray
    ctx.fill()

    ctx.restore()
  }
  ctx.restore()

  // 4. Central starburst glow (behind nucleus)
  const burst = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.min(w, h) * 0.3)
  burst.addColorStop(0,   'rgba(200, 240, 255, 0.35)')
  burst.addColorStop(0.15, 'rgba(100, 200, 255, 0.15)')
  burst.addColorStop(0.4,  'rgba(0, 100, 255, 0.05)')
  burst.addColorStop(1,    'rgba(0, 0, 0, 0)')
  ctx.fillStyle = burst
  ctx.fillRect(0, 0, w, h)

  // 5. Subtle nebula wisps
  const clouds: [number, number, number, string][] = [
    [CX - w * 0.25, CY - h * 0.08, w * 0.22, 'rgba(0, 100, 200, 0.02)'],
    [CX + w * 0.20, CY + h * 0.12, w * 0.18, 'rgba(60, 0, 180, 0.015)'],
  ]
  clouds.forEach(([cx, cy, r, color]) => {
    const cloud = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    cloud.addColorStop(0, color)
    cloud.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = cloud
    ctx.fill()
  })

  // 6. Stars — small subtle dots (no cross-flares)
  for (let i = 0; i < 1200; i++) {
    const sx = rng() * w
    const sy = rng() * h
    const size = rng() * 1.1 + 0.1

    const distToCenter = Math.hypot(sx - CX, sy - CY) / (Math.max(w, h) * 0.5)

    const alpha = rng() * 0.45 + 0.08
    let color: string

    if (distToCenter < 0.5 && rng() > 0.5) {
      color = `rgba(180, 230, 255, ${alpha})`
    } else if (rng() > 0.88) {
      color = `rgba(200, 160, 255, ${alpha * 0.8})`
    } else if (rng() > 0.94) {
      color = `rgba(255, 220, 150, ${alpha * 0.7})`
    } else {
      color = `rgba(255, 255, 255, ${alpha})`
    }

    ctx.beginPath()
    ctx.arc(sx, sy, size, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    // Tiny bloom for bigger stars
    if (size > 0.9 && rng() > 0.75) {
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, size * 3.5)
      glow.addColorStop(0, color.replace(/[\d.]+\)$/, '0.1)'))
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(sx, sy, size * 3.5, 0, Math.PI * 2)
      ctx.fillStyle = glow
      ctx.fill()
    }
  }

  // 7. Vignette
  const vig = ctx.createRadialGradient(CX, CY, Math.min(w, h) * 0.3, CX, CY, Math.max(w, h) * 0.75)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,4,0.75)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, w, h)

  return gc
}
