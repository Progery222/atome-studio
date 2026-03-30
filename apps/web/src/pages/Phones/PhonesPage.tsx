import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Phone } from '@atome/shared'
import { useFarmStore } from '../../stores/farm'
import styles from './PhonesPage.module.css'

const STATUS_COLOR: Record<Phone['status'], string> = {
  active:    '#22c55e',
  warmup:    '#fbbf24',
  paused:    '#60a5fa',
  offline:   '#6b7280',
  banned:    '#ef4444',
  error:     '#ef4444',
}

const STATUS_LABEL: Record<Phone['status'], string> = {
  active:    'online',
  warmup:    'warmup',
  paused:    'paused',
  offline:   'offline',
  banned:    'banned',
  error:     'error',
}

function healthColor(score: number) {
  if (score >= 80) return '#22c55e'
  if (score >= 50) return '#fbbf24'
  return '#ef4444'
}

// ─── Phone Card ───────────────────────────────────────────────────────────────

function PhoneCard({ phone }: { phone: Phone }) {
  const pausePhone  = useFarmStore((s) => s.pausePhone)
  const resumePhone = useFarmStore((s) => s.resumePhone)
  const col         = STATUS_COLOR[phone.status]
  const hc          = healthColor(phone.health_score)

  return (
    <div className={styles.card}>
      {/* Header row */}
      <div className={styles.cardHeader}>
        <span className={styles.statusDot} style={{ background: col, boxShadow: `0 0 6px ${col}` }} />
        <Link
          to={`/phones/${phone.phone_id}`}
          className={styles.serial}
          onClick={(e) => e.stopPropagation()}
        >
          {phone.serial || phone.phone_id}
        </Link>
        <span className={styles.statusTag} style={{ color: col }}>
          {STATUS_LABEL[phone.status]}
        </span>
      </div>

      {/* Model */}
      <div className={styles.model}>{phone.model || '—'}</div>

      {/* Health bar */}
      <div className={styles.healthRow}>
        <span className={styles.healthLabel}>health</span>
        <div className={styles.healthBar}>
          <div
            className={styles.healthFill}
            style={{ width: `${phone.health_score}%`, background: hc }}
          />
        </div>
        <span className={styles.healthVal} style={{ color: hc }}>
          {phone.health_score}%
        </span>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Посты</span>
          <span className={styles.statValue}>{phone.posts_today}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Аккаунты</span>
          <span className={styles.statValue}>{phone.accounts?.length ?? 0}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>День</span>
          <span className={styles.statValue}>{phone.warmup_day}</span>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {phone.status === 'paused' ? (
          <button
            className={styles.btn}
            onClick={() => resumePhone(phone.phone_id)}
          >
            ▶ Возобновить
          </button>
        ) : (
          <button
            className={`${styles.btn} ${styles.btnPause}`}
            onClick={() => pausePhone(phone.phone_id)}
          >
            ⏸ Пауза
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PhonesPage() {
  const phones        = useFarmStore((s) => s.phones)
  const phonesLoading = useFarmStore((s) => s.phonesLoading)
  const fetchPhones   = useFarmStore((s) => s.fetchPhones)

  useEffect(() => {
    fetchPhones()
    const id = setInterval(fetchPhones, 30_000)
    return () => clearInterval(id)
  }, [fetchPhones])

  const online  = phones.filter((p) => p.status === 'active').length
  const subtitle = phonesLoading
    ? 'загрузка...'
    : phones.length > 0
      ? `${phones.length} устройств · ${online} онлайн`
      : 'нет данных'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>Телефоны</div>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>
        <button className={styles.syncBtn} onClick={fetchPhones}>
          обновить
        </button>
      </header>

      {phones.length === 0 && !phonesLoading ? (
        <div className={styles.empty}>
          — нет телефонов · orchestrator недоступен
        </div>
      ) : (
        <div className={styles.grid}>
          {phones.map((p) => (
            <PhoneCard key={p.phone_id} phone={p} />
          ))}
        </div>
      )}
    </div>
  )
}
