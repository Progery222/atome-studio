import { useServicesStore } from '../../stores/services'
import { Service } from '@atome/shared'
import styles from './SidePanel.module.css'

const STATUS_COLOR: Record<string, string> = {
  online:   '#22c55e',
  degraded: '#eab308',
  offline:  '#ef4444',
  error:    '#ef4444',
}

const STATUS_DOT: Record<string, string> = {
  online:   styles.dotOnline,
  degraded: styles.dotIdle,
  offline:  styles.dotOffline,
  error:    styles.dotOffline,
}

export function SidePanel() {
  const farmStats  = useServicesStore((s) => s.farmStats)
  const services   = useServicesStore((s) => s.services)
  const selectedId = useServicesStore((s) => s.selectedId)
  const loading    = useServicesStore((s) => s.loading)

  const selected = services.find((s) => s.id === selectedId) ?? null

  return (
    <aside className={styles.panel}>
      {/* Header */}
      <div>
        <div className={styles.title}>Atome Studio</div>
        <div className={styles.subtitle}>
          {loading ? 'connecting...' : 'farm · live'}
        </div>
      </div>

      {/* Service detail card or Farm stats */}
      {selected ? (
        <ServiceCard service={selected} onClose={() => useServicesStore.getState().setSelected(null)} />
      ) : (
        <FarmStatsPanel
          phonesOnline={farmStats.phones_online}
          phonesTotal={farmStats.phones_total}
          accountsActive={farmStats.accounts_active}
          accountsTotal={farmStats.accounts_total}
          postsToday={farmStats.posts_today}
          activeJobs={farmStats.active_jobs}
          lastEvent={farmStats.last_event}
        />
      )}

      {/* Services status list */}
      <div>
        <div className={styles.section}>Сервисы</div>
        <div className={styles.platformList}>
          {services.map((svc) => (
            <div
              key={svc.id}
              className={`${styles.serviceRow} ${svc.id === selectedId ? styles.serviceRowActive : ''}`}
              onClick={() => useServicesStore.getState().setSelected(
                svc.id === selectedId ? null : svc.id
              )}
            >
              <span className={`${styles.dot} ${STATUS_DOT[svc.status] ?? ''}`} />
              <span className={styles.serviceName}>{svc.name}</span>
              <span className={styles.serviceTag} style={{ color: STATUS_COLOR[svc.status] }}>
                {svc.status}
              </span>
            </div>
          ))}
          {services.length === 0 && !loading && (
            <div className={styles.serviceTag} style={{ padding: '4px 7px' }}>
              нет данных — api недоступен
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

// ─── Farm Stats Panel ─────────────────────────────────────────────────────────

interface FarmStatsPanelProps {
  phonesOnline:   number
  phonesTotal:    number
  accountsActive: number
  accountsTotal:  number
  postsToday:     number
  activeJobs:     number
  lastEvent?:     string
}

function FarmStatsPanel({
  phonesOnline, phonesTotal, accountsActive, accountsTotal,
  postsToday, activeJobs, lastEvent,
}: FarmStatsPanelProps) {
  return (
    <div>
      <div className={styles.section}>Статистика фермы</div>
      <div className={styles.statsGrid}>
        <StatBox
          label="Публикаций сегодня"
          value={postsToday}
          color="#00d8a8"
        />
        <StatBox
          label="Телефонов онлайн"
          value={`${phonesOnline}${phonesTotal > 0 ? `/${phonesTotal}` : ''}`}
          color="#4a9eff"
        />
        <StatBox
          label="Аккаунтов активных"
          value={`${accountsActive}${accountsTotal > 0 ? `/${accountsTotal}` : ''}`}
          color="#a78bfa"
        />
        <StatBox
          label="Генерируется"
          value={activeJobs}
          color="#fbbf24"
        />
      </div>
      {lastEvent && (
        <div className={styles.statBox} style={{ marginTop: 7 }}>
          <div className={styles.statLabel}>Последнее событие</div>
          <div className={styles.serviceName} style={{ fontSize: 9, marginTop: 3 }}>
            {lastEvent}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Service Detail Card ──────────────────────────────────────────────────────

function ServiceCard({ service, onClose }: { service: Service; onClose: () => void }) {
  const [cr, cg, cb] = service.col

  return (
    <div>
      <div className={styles.section} style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Детали сервиса</span>
        <span
          onClick={onClose}
          style={{ cursor: 'pointer', color: 'rgba(55,115,195,0.6)', letterSpacing: 0 }}
        >
          ✕
        </span>
      </div>
      <div className={styles.statBox}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span
            style={{
              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
              background: `rgb(${cr},${cg},${cb})`,
              boxShadow: `0 0 8px rgba(${cr},${cg},${cb},0.8)`,
            }}
          />
          <span style={{ fontSize: 13, color: '#c8d8f0', fontWeight: 700 }}>{service.name}</span>
        </div>

        <Row label="Статус"  value={service.status}  color={STATUS_COLOR[service.status]} />
        {service.uptime !== undefined && (
          <Row label="Uptime" value={`${service.uptime.toFixed(1)}%`} />
        )}
        {service.activeJobs !== undefined && (
          <Row label="Активных jobs" value={String(service.activeJobs)} color="#fbbf24" />
        )}
      </div>
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <span className={styles.statLabel} style={{ marginBottom: 0 }}>{label}</span>
      <span style={{ fontSize: 9, color: color ?? 'rgba(145,192,232,0.65)' }}>{value}</span>
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={styles.statBox}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue} style={{ color }}>{value}</div>
    </div>
  )
}
