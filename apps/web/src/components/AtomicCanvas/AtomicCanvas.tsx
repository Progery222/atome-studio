import { useRef, useEffect, useCallback } from 'react'
import { ORBIT_CONFIGS } from '@atome/shared'
import { useServicesStore } from '../../stores/services'
import { render, resetGalaxy, initAngles, AtomHitTarget } from './renderer'
import styles from './AtomicCanvas.module.css'

const DPR = window.devicePixelRatio || 1
const HIT_RADIUS = 14

export function AtomicCanvas() {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const frameRef    = useRef<number>(0)
  const hitsRef     = useRef<AtomHitTarget[]>([])

  const services      = useServicesStore((s) => s.services)
  const highlightedId = useServicesStore((s) => s.highlightedId)
  const setTooltip    = useServicesStore((s) => s.setTooltip)
  const setSelected   = useServicesStore((s) => s.setSelected)

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    initAngles(services)

    const loop = () => {
      hitsRef.current = render(canvas, services, ORBIT_CONFIGS, highlightedId, DPR)
      frameRef.current = requestAnimationFrame(loop)
    }
    frameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameRef.current)
  }, [services, highlightedId])

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      resetGalaxy()
    })
    ro.observe(canvas.parentElement!)
    return () => ro.disconnect()
  }, [])

  // Mouse move — tooltip
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    let hit: AtomHitTarget | null = null
    for (const h of hitsRef.current) {
      const dx = h.x - mx
      const dy = h.y - my
      if (dx * dx + dy * dy < HIT_RADIUS * HIT_RADIUS) {
        hit = h
        break
      }
    }

    if (hit) {
      setTooltip({ x: e.clientX, y: e.clientY, service: hit.service })
    } else {
      setTooltip(null)
    }
  }, [setTooltip])

  const onMouseLeave = useCallback(() => {
    setTooltip(null)
  }, [setTooltip])

  // Click — select service (FR-1.4)
  const onClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    let hit: AtomHitTarget | null = null
    for (const h of hitsRef.current) {
      const dx = h.x - mx
      const dy = h.y - my
      if (dx * dx + dy * dy < HIT_RADIUS * HIT_RADIUS) {
        hit = h
        break
      }
    }

    setSelected(hit ? hit.service.id : null)
  }, [setSelected])

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    />
  )
}
