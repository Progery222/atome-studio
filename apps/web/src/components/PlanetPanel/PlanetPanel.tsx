import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GalaxyService } from '../AtomicCanvas/engine'
import styles from './PlanetPanel.module.css'

interface Props {
  service: GalaxyService
  exiting?: boolean
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = {
  generator:    'Генерация контента',
  orchestrator: 'Оркестратор',
  farm:         'Ферма устройств',
  storage:      'Хранилище',
  api:          'Backend API',
}

const SERVICE_ACTIONS: Record<string, { label: string; style: string; route?: string }[]> = {
  sportzavod: [
    { label: 'Запустить генерацию', style: 'primary', route: '/generate' },
    { label: 'Очередь задач', style: 'default', route: '/queue' },
    { label: 'Аккаунты', style: 'default', route: '/accounts' },
  ],
  contentzavod: [
    { label: 'Генерация контента', style: 'primary', route: '/generate' },
    { label: 'Библиотека видео', style: 'default', route: '/videos' },
    { label: 'Аккаунты', style: 'default', route: '/accounts' },
  ],
  orchestrator: [
    { label: 'Очередь публикаций', style: 'primary', route: '/queue' },
    { label: 'Телефоны', style: 'default', route: '/phones' },
    { label: 'Обзор системы', style: 'default', route: '/' },
  ],
  farm: [
    { label: 'Управление телефонами', style: 'primary', route: '/phones' },
    { label: 'Аккаунты TikTok', style: 'default', route: '/accounts' },
    { label: 'Очередь публикаций', style: 'default', route: '/queue' },
  ],
  minio: [
    { label: 'Библиотека видео', style: 'primary', route: '/videos' },
  ],
  'dashboard-api': [
    { label: 'Настройки системы', style: 'primary', route: '/settings' },
    { label: 'Обзор сервисов', style: 'default', route: '/' },
  ],
}

function useNeuralNetwork(subsCount: number, serviceId: string) {
  return useMemo(() => {
    const seed = serviceId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const rng = (i: number) => ((seed * 9301 + i * 49297) % 233280) / 233280

    const nodeCount = Math.max(subsCount + 3, 8)
    const nodes: { x: number; y: number; r: number }[] = []
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: 20 + rng(i * 3) * 400,
        y: 12 + rng(i * 3 + 1) * 110,
        r: 3 + rng(i * 3 + 2) * 4,
      })
    }

    const edges: { from: number; to: number; delay: number }[] = []
    for (let i = 0; i < nodeCount; i++) {
      const target = (i + 1 + Math.floor(rng(i * 7) * (nodeCount - 2))) % nodeCount
      if (target !== i) edges.push({ from: i, to: target, delay: rng(i * 11) * 2 })
      if (rng(i * 13) > 0.5) {
        const t2 = (i + 2 + Math.floor(rng(i * 17) * (nodeCount - 3))) % nodeCount
        if (t2 !== i) edges.push({ from: i, to: t2, delay: rng(i * 19) * 2 })
      }
    }
    return { nodes, edges }
  }, [subsCount, serviceId])
}

export function PlanetPanel({ service, exiting: exitingProp = false, onClose }: Props) {
  const navigate = useNavigate()
  const [exitingLocal, setExitingLocal] = useState(false)
  const neural = useNeuralNetwork(service.subs.length, service.id)

  const isExiting = exitingProp || exitingLocal

  const handleClose = () => {
    if (isExiting) return
    setExitingLocal(true)
    setTimeout(onClose, 450)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const [r, g, b] = service.color
  const ri = Math.round(r * 255), gi = Math.round(g * 255), bi = Math.round(b * 255)
  const cssColor = `rgb(${ri}, ${gi}, ${bi})`
  const glowColor = `rgba(${ri}, ${gi}, ${bi}, 0.06)`
  const colorAlpha = (a: number) => `rgba(${ri}, ${gi}, ${bi}, ${a})`

  const actions = SERVICE_ACTIONS[service.id] ?? []

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div
        className={`${styles.panel} ${isExiting ? styles.panelExit : ''}`}
        style={{
          '--panel-glow': glowColor,
          '--panel-color': colorAlpha(0.4),
          '--panel-color-text': colorAlpha(0.9),
        } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Slash effects */}
        {!isExiting && <div className={styles.slashLine} />}
        {isExiting && <div className={styles.slashLineExit} />}
        {<div className={styles.glitchLines} />}

        {/* Holographic overlay */}
        <div className={styles.holoOverlay}>
          <div className={styles.scanLine} />
          <div className={styles.holoGrid} />
        </div>

        <div className={styles.content}>
          {/* Header */}
          <div className={styles.header}>
            <div
              className={styles.planetDot}
              style={{ background: cssColor, boxShadow: `0 0 16px ${cssColor}`, color: cssColor }}
            />
            <div className={styles.titleBlock}>
              <div className={styles.name}>{service.name}</div>
              <div className={styles.typeTag}>{TYPE_LABELS[service.type] ?? service.type}</div>
            </div>
            <button className={styles.closeBtn} onClick={handleClose}>&#x2715;</button>
          </div>

          {/* Neural map */}
          <div className={styles.neuralSection}>
            <svg className={styles.neuralSvg} viewBox="0 0 440 130" preserveAspectRatio="none">
              {neural.edges.map((e, i) => {
                const a = neural.nodes[e.from]
                const nd = neural.nodes[e.to]
                return (
                  <line key={`e${i}`}
                    x1={a.x} y1={a.y} x2={nd.x} y2={nd.y}
                    stroke={colorAlpha(0.2)} strokeWidth="0.8" strokeDasharray="4 4"
                    className={styles.neuralPulse}
                    style={{ animationDelay: `${e.delay}s` }}
                  />
                )
              })}
              {neural.nodes.map((n, i) => (
                <circle key={`n${i}`}
                  cx={n.x} cy={n.y} r={n.r}
                  fill={colorAlpha(0.5)}
                  className={styles.neuralNode}
                  style={{ animationDelay: `${i * 0.3}s` }}
                />
              ))}
            </svg>
            <div className={styles.neuralLabel}>neural map</div>
          </div>

          {/* Metrics */}
          <div className={styles.metricsRow}>
            <div className={styles.metricBox}>
              <div className={styles.metricValue}>{service.metrics.latency}</div>
              <div className={styles.metricLabel}>Latency</div>
            </div>
            <div className={styles.metricBox}>
              <div className={styles.metricValue}>{service.metrics.load}</div>
              <div className={styles.metricLabel}>Load</div>
            </div>
            <div className={styles.metricBox}>
              <div className={styles.metricValue}>{service.metrics.rps}</div>
              <div className={styles.metricLabel}>RPS</div>
            </div>
            <div className={styles.metricBox}>
              <div className={styles.metricValue}>{service.metrics.errors}</div>
              <div className={styles.metricLabel}>Errors</div>
            </div>
          </div>

          {/* Subsystems */}
          <div className={styles.subsLabel}>Подсистемы</div>
          <div className={styles.subsList}>
            {service.subs.map((sub, i) => (
              <div key={sub.name} className={styles.subChip}
                style={{ animationDelay: `${0.5 + i * 0.08}s` }}
              >
                <span className={styles.subDot}
                  style={{ background: sub.color, boxShadow: `0 0 6px ${sub.color}` }}
                />
                {sub.name}
                <span className={styles.subStatus} style={{ color: sub.color }}>
                  {sub.status}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          {actions.length > 0 && (
            <div className={styles.actions}>
              {actions.map((act) => (
                <button key={act.label}
                  className={`${styles.actionBtn} ${
                    act.style === 'primary' ? styles.actionPrimary :
                    act.style === 'danger'  ? styles.actionDanger  : ''
                  }`}
                  onClick={() => { if (act.route) navigate(act.route) }}
                >
                  {act.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
