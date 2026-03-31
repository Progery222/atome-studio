import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useServicesStore } from '../../stores/services'
import { GalaxyEngine } from './engine'
import styles from './AtomicCanvas.module.css'

export interface AtomicCanvasHandle {
  startDemo: () => void
  stopDemo: () => void
  isDemoActive: () => boolean
}

export const AtomicCanvas = forwardRef<AtomicCanvasHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GalaxyEngine | null>(null)

  const setTooltip  = useServicesStore((s) => s.setTooltip)
  const setSelected = useServicesStore((s) => s.setSelected)

  useImperativeHandle(ref, () => ({
    startDemo: () => engineRef.current?.startDemo(),
    stopDemo:  () => engineRef.current?.stopDemo(),
    isDemoActive: () => engineRef.current?.isDemoActive ?? false,
  }))

  useEffect(() => {
    if (!canvasRef.current) return

    engineRef.current = new GalaxyEngine(
      canvasRef.current,
      (_id) => {
        // hover callback — tooltip is handled via labels
      },
      (id) => { if (id) setSelected(id) }
    )

    return () => {
      engineRef.current?.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      onMouseLeave={() => setTooltip(null)}
    />
  )
})

AtomicCanvas.displayName = 'AtomicCanvas'
