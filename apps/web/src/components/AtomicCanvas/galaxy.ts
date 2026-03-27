/**
 * Builds and caches the static galaxy background (nebulae, stars, Milky Way).
 * Rendered once per resize into an offscreen canvas.
 */
export function buildGalaxy(w: number, h: number, dpr: number): HTMLCanvasElement {
  const gc = document.createElement('canvas')
  gc.width  = Math.ceil(w * dpr)
  gc.height = Math.ceil(h * dpr)
  const ctx = gc.getContext('2d')!
  ctx.scale(dpr, dpr)

  // Deep space gradient background
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.85)
  bg.addColorStop(0,    '#010510')
  bg.addColorStop(0.55, '#01030a')
  bg.addColorStop(1,    '#000208')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // Nebula clouds
  const nebulae: [number, number, number, [number,number,number], number][] = [
    [w * 0.14, h * 0.18, w * 0.42, [40, 16, 92],   0.11],
    [w * 0.82, h * 0.76, w * 0.38, [8, 38, 112],   0.09],
    [w * 0.66, h * 0.14, w * 0.28, [82, 10, 122],  0.07],
    [w * 0.30, h * 0.82, w * 0.32, [10, 62, 132],  0.08],
    [w * 0.88, h * 0.30, w * 0.24, [128, 26, 84],  0.06],
  ]
  nebulae.forEach(([nx, ny, nr, c, alpha]) => {
    const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr)
    g.addColorStop(0,   `rgba(${c},${alpha})`)
    g.addColorStop(0.5, `rgba(${c},${alpha * 0.28})`)
    g.addColorStop(1,   'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })

  // Background micro-stars
  for (let i = 0; i < 5500; i++) {
    ctx.beginPath()
    ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 0.7 + 0.1, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(172,208,242,${Math.random() * 0.28 + 0.04})`
    ctx.fill()
  }

  // Milky Way spiral
  const gx = w * 0.48, gy = h * 0.52
  const maxR = Math.min(w, h) * 0.64
  for (let i = 0; i < 800; i++) {
    const angle = (i / 800) * Math.PI * 6
    const r = (i / 800) * maxR
    const spread = r * 0.22
    const px = gx + Math.cos(angle) * r + (Math.random() - 0.5) * spread
    const py = gy + Math.sin(angle) * r * 0.38 + (Math.random() - 0.5) * spread * 0.38
    const brightness = Math.random() * 0.18 + 0.04
    ctx.beginPath()
    ctx.arc(px, py, Math.random() * 0.9 + 0.2, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(180,210,255,${brightness})`
    ctx.fill()
  }

  return gc
}
