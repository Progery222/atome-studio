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
  const diag = Math.max(w, h)

  // 1. Deep black background
  ctx.fillStyle = '#000005'
  ctx.fillRect(0, 0, w, h)

  // 2. Wide atmospheric blue nebula haze
  const haze1 = ctx.createRadialGradient(CX, CY, 0, CX, CY, diag * 0.55)
  haze1.addColorStop(0,   'rgba(8, 40, 90, 0.35)')
  haze1.addColorStop(0.2, 'rgba(5, 25, 70, 0.20)')
  haze1.addColorStop(0.5, 'rgba(2, 12, 40, 0.08)')
  haze1.addColorStop(1,   'rgba(0, 0, 0, 0)')
  ctx.fillStyle = haze1
  ctx.fillRect(0, 0, w, h)

  // 3. Volumetric god rays — wide, soft light beams
  ctx.save()
  ctx.translate(CX, CY)

  // Layer A: Wide soft beams (the main volumetric light)
  const wideRayCount = 40
  for (let i = 0; i < wideRayCount; i++) {
    const angle = (Math.PI * 2 * i) / wideRayCount + (rng() - 0.5) * 0.12
    const length = diag * (0.45 + rng() * 0.4)
    const thickness = 20 + rng() * 60  // very wide beams
    const brightness = 0.03 + rng() * 0.06

    ctx.save()
    ctx.rotate(angle)

    const ray = ctx.createLinearGradient(0, 0, length, 0)
    ray.addColorStop(0,    `rgba(200, 235, 255, ${brightness * 3.0})`)
    ray.addColorStop(0.05, `rgba(140, 210, 255, ${brightness * 2.0})`)
    ray.addColorStop(0.15, `rgba(60, 150, 255, ${brightness * 1.2})`)
    ray.addColorStop(0.4,  `rgba(15, 60, 180, ${brightness * 0.4})`)
    ray.addColorStop(0.7,  `rgba(5, 20, 80, ${brightness * 0.08})`)
    ray.addColorStop(1,    'rgba(0, 5, 30, 0)')

    ctx.beginPath()
    ctx.moveTo(0, -thickness / 2)
    ctx.lineTo(length, -thickness * 0.08)
    ctx.lineTo(length, thickness * 0.08)
    ctx.lineTo(0, thickness / 2)
    ctx.closePath()
    ctx.fillStyle = ray
    ctx.fill()

    ctx.restore()
  }

  // Layer B: Thinner, brighter accent rays
  const thinRayCount = 70
  for (let i = 0; i < thinRayCount; i++) {
    const angle = (Math.PI * 2 * i) / thinRayCount + (rng() - 0.5) * 0.08
    const length = diag * (0.25 + rng() * 0.55)
    const thickness = 2 + rng() * 14
    const brightness = 0.04 + rng() * 0.10

    ctx.save()
    ctx.rotate(angle)

    const ray = ctx.createLinearGradient(0, 0, length, 0)
    ray.addColorStop(0,    `rgba(240, 250, 255, ${brightness * 2.8})`)
    ray.addColorStop(0.06, `rgba(180, 230, 255, ${brightness * 1.8})`)
    ray.addColorStop(0.2,  `rgba(60, 160, 255, ${brightness * 0.8})`)
    ray.addColorStop(0.5,  `rgba(10, 60, 180, ${brightness * 0.2})`)
    ray.addColorStop(1,    'rgba(0, 20, 80, 0)')

    ctx.beginPath()
    ctx.moveTo(0, -thickness / 2)
    ctx.lineTo(length, 0)
    ctx.lineTo(0, thickness / 2)
    ctx.fillStyle = ray
    ctx.fill()

    ctx.restore()
  }

  ctx.restore()

  // 4. Strong central bloom — the bright core light source
  // Outer soft bloom
  const bloom1 = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.min(w, h) * 0.45)
  bloom1.addColorStop(0,    'rgba(220, 245, 255, 0.50)')
  bloom1.addColorStop(0.08, 'rgba(150, 220, 255, 0.30)')
  bloom1.addColorStop(0.2,  'rgba(60, 160, 255, 0.15)')
  bloom1.addColorStop(0.4,  'rgba(20, 80, 200, 0.05)')
  bloom1.addColorStop(1,    'rgba(0, 0, 0, 0)')
  ctx.fillStyle = bloom1
  ctx.fillRect(0, 0, w, h)

  // Inner bright core
  const bloom2 = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.min(w, h) * 0.15)
  bloom2.addColorStop(0,   'rgba(255, 255, 255, 0.35)')
  bloom2.addColorStop(0.3, 'rgba(200, 240, 255, 0.20)')
  bloom2.addColorStop(0.7, 'rgba(80, 180, 255, 0.06)')
  bloom2.addColorStop(1,   'rgba(0, 0, 0, 0)')
  ctx.fillStyle = bloom2
  ctx.fillRect(0, 0, w, h)

  // 5. Subtle nebula wisps
  const clouds: [number, number, number, string][] = [
    [CX - w * 0.28, CY - h * 0.06, w * 0.25, 'rgba(10, 60, 160, 0.03)'],
    [CX + w * 0.22, CY + h * 0.10, w * 0.20, 'rgba(40, 10, 140, 0.025)'],
    [CX - w * 0.05, CY + h * 0.20, w * 0.15, 'rgba(0, 40, 120, 0.02)'],
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

  // 6. Stars — small subtle dots
  for (let i = 0; i < 1400; i++) {
    const sx = rng() * w
    const sy = rng() * h
    const size = rng() * 1.0 + 0.1

    const distToCenter = Math.hypot(sx - CX, sy - CY) / (diag * 0.5)
    // Stars dimmer near center (drowned out by glow)
    const centerDim = Math.max(0.2, Math.min(1, distToCenter * 1.5))

    const alpha = (rng() * 0.40 + 0.05) * centerDim
    let color: string

    if (rng() > 0.92) {
      color = `rgba(200, 160, 255, ${alpha * 0.8})`   // purple tint
    } else if (rng() > 0.94) {
      color = `rgba(255, 220, 150, ${alpha * 0.7})`   // warm tint
    } else if (rng() > 0.85) {
      color = `rgba(180, 220, 255, ${alpha})`          // blue tint
    } else {
      color = `rgba(255, 255, 255, ${alpha})`          // white
    }

    ctx.beginPath()
    ctx.arc(sx, sy, size, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    // Tiny bloom for bigger stars
    if (size > 0.85 && rng() > 0.7) {
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, size * 4)
      glow.addColorStop(0, color.replace(/[\d.]+\)$/, '0.08)'))
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(sx, sy, size * 4, 0, Math.PI * 2)
      ctx.fillStyle = glow
      ctx.fill()
    }
  }

  // 7. Vignette — dark edges
  const vig = ctx.createRadialGradient(CX, CY, Math.min(w, h) * 0.35, CX, CY, diag * 0.72)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(0.6, 'rgba(0,0,2,0.3)')
  vig.addColorStop(1, 'rgba(0,0,3,0.85)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, w, h)

  return gc
}
