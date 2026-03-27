import { useRef, useEffect } from 'react'
import { SparklinePoint } from '@atome/shared'
import styles from './Sparkline.module.css'

interface Props {
  label: string
  points: SparklinePoint[]
  color?: string
}

export function Sparkline({ label, points, color = '#4a9eff' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const currentVal = points[points.length - 1]?.value ?? 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || points.length < 2) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.offsetWidth || 232
    const H = 36
    canvas.width  = W
    canvas.height = H
    ctx.clearRect(0, 0, W, H)

    const vals  = points.map((p) => p.value)
    const minV  = Math.min(...vals)
    const maxV  = Math.max(...vals)
    const range = maxV - minV || 1

    const toX = (i: number) => (i / (vals.length - 1)) * W
    const toY = (v: number) => H - ((v - minV) / range) * (H - 4) - 2

    // Fill gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, `${color}28`)
    grad.addColorStop(1, `${color}00`)
    ctx.beginPath()
    ctx.moveTo(toX(0), toY(vals[0]))
    vals.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)) })
    ctx.lineTo(toX(vals.length - 1), H)
    ctx.lineTo(0, H)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // Line
    ctx.beginPath()
    ctx.moveTo(toX(0), toY(vals[0]))
    vals.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)) })
    ctx.strokeStyle = color
    ctx.lineWidth   = 1.2
    ctx.stroke()
  }, [points, color])

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{currentVal.toFixed(0)}</span>
      </div>
      <canvas ref={canvasRef} className={styles.canvas} height={36} />
    </div>
  )
}
