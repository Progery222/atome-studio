import { useMemo } from 'react'
import { Platform, PLATFORM_COLORS } from '@atome/shared'
import { useServicesStore } from '../../stores/services'
import { Sparkline } from '../Sparkline/Sparkline'
import styles from './SidePanel.module.css'

const PLATFORMS: Platform[] = ['Cloudflare', 'PostHog', 'Postman']

const STATUS_DOT_CLASS: Record<string, string> = {
  online:  styles.dotOnline,
  offline: styles.dotOffline,
  idle:    styles.dotIdle,
  error:   styles.dotOffline,
}

export function SidePanel() {
  const services     = useServicesStore((s) => s.services)
  const metrics      = useServicesStore((s) => s.metrics)
  const highlightedId = useServicesStore((s) => s.highlightedId)
  const setHighlighted = useServicesStore((s) => s.setHighlighted)

  const stats = useMemo(() => ({
    total:    services.length,
    online:   services.filter((s) => s.status === 'online').length,
    platforms: PLATFORMS.filter((p) => services.some((s) => s.platform === p)).length,
    uptime:   99.9,
  }), [services])

  const byPlatform = useMemo(() =>
    PLATFORMS.map((p) => ({
      platform: p,
      services: services.filter((s) => s.platform === p),
    })).filter((g) => g.services.length > 0),
  [services])

  return (
    <aside className={styles.panel}>
      {/* Header */}
      <div>
        <div className={styles.title}>Atome Studio</div>
        <div className={styles.subtitle}>workspace · live</div>
      </div>

      {/* Stats */}
      <div>
        <div className={styles.section}>System</div>
        <div className={styles.statsGrid}>
          <StatBox label="Services" value={stats.total}    color="cy" />
          <StatBox label="Online"   value={stats.online}   color="tl" />
          <StatBox label="Platforms" value={stats.platforms} color="bl" />
          <StatBox label="Uptime"   value={`${stats.uptime}%`} color="tl" />
        </div>
      </div>

      {/* Services by platform */}
      <div>
        <div className={styles.section}>Services by Platform</div>
        <div className={styles.platformList}>
          {byPlatform.map(({ platform, services: svcs }) => {
            const col = PLATFORM_COLORS[platform]
            return (
              <div key={platform} className={styles.platformBlock}>
                <div className={styles.platformHeader}>
                  <span
                    className={styles.badge}
                    style={{
                      color: col.hex,
                      background: `rgba(${col.rgb},0.12)`,
                      border: `1px solid rgba(${col.rgb},0.2)`,
                    }}
                  >
                    {platform}
                  </span>
                  <span className={styles.count}>{svcs.length} service{svcs.length !== 1 ? 's' : ''}</span>
                </div>
                {svcs.map((svc) => (
                  <div
                    key={svc.id}
                    className={`${styles.serviceRow} ${svc.id === highlightedId ? styles.serviceRowActive : ''}`}
                    onMouseEnter={() => setHighlighted(svc.id)}
                    onMouseLeave={() => setHighlighted(null)}
                  >
                    <span
                      className={`${styles.dot} ${STATUS_DOT_CLASS[svc.status] ?? ''}`}
                      style={
                        svc.status === 'online' || svc.status === 'idle'
                          ? undefined
                          : { background: col.hex, boxShadow: `0 0 6px rgba(${col.rgb},0.8)` }
                      }
                    />
                    <span className={styles.serviceName}>{svc.name}</span>
                    <span className={styles.serviceTag}>{svc.type}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Activity sparklines */}
      <div>
        <div className={styles.section}>Activity</div>
        <div className={styles.sparklines}>
          <Sparkline label="Events/min" points={metrics.eventsPerMin} color="#4a9eff" />
          <Sparkline label="API calls"  points={metrics.apiCalls}     color="#00d8a8" />
          <Sparkline label="Latency"    points={metrics.latencyMs}    color="#f97316" />
        </div>
      </div>
    </aside>
  )
}

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  const colorMap: Record<string, string> = {
    cy: '#00d8f0',
    tl: '#00d8a8',
    bl: '#4a9eff',
  }
  return (
    <div className={styles.statBox}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue} style={{ color: colorMap[color] ?? '#fff' }}>
        {value}
      </div>
    </div>
  )
}
