import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GalaxyService } from '../AtomicCanvas/engine'
import { NeuralBg } from './NeuralBg'
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


export function PlanetPanel({ service, exiting: exitingProp = false, onClose }: Props) {
  const navigate = useNavigate()
  const [exitingLocal, setExitingLocal] = useState(false)

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
      {/* Blurred backdrop */}
      <div className={`${styles.backdrop} ${isExiting ? styles.backdropExit : ''}`} />

      {/* Fullscreen neural network — canvas with beam-shader-like packets */}
      <NeuralBg serviceId={service.id} color={service.color} exiting={isExiting} />

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
