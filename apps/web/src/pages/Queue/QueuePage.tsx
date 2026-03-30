import { useEffect, useState } from 'react'
import { QueueTask } from '@atome/shared'
import { useFarmStore } from '../../stores/farm'
import styles from './QueuePage.module.css'

type Filter = 'all' | 'in_progress' | 'scheduled' | 'published' | 'failed'

const FILTER_LABELS: Record<Filter, string> = {
  all:         'Все',
  in_progress: 'В работе',
  scheduled:   'Запланировано',
  published:   'Опубликовано',
  failed:      'Ошибки',
}

const STATUS_COLOR: Record<QueueTask['status'], string> = {
  scheduled:   '#60a5fa',
  in_progress: '#22c55e',
  published:   'rgba(34,197,94,0.45)',
  failed:      '#ef4444',
}

const STATUS_LABEL: Record<QueueTask['status'], string> = {
  scheduled:   'запланировано',
  in_progress: 'публикуется сейчас',
  published:   'опубликовано',
  failed:      'ошибка',
}

function formatCountdown(scheduledAt: string): string {
  const diff = new Date(scheduledAt).getTime() - Date.now()
  if (diff <= 0) return 'сейчас'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `через ${h}ч ${m}м`
  return `через ${m}м`
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

// ─── Countdown cell ──────────────────────────────────────────────────────────

function Countdown({ task }: { task: QueueTask }) {
  const [label, setLabel] = useState(() => {
    if (task.status === 'in_progress') return 'публикуется сейчас'
    if (task.status === 'published')   return 'опубликовано'
    if (task.status === 'failed')      return 'ошибка'
    return formatCountdown(task.scheduled_at)
  })

  useEffect(() => {
    if (task.status !== 'scheduled') return
    const id = setInterval(() => {
      setLabel(formatCountdown(task.scheduled_at))
    }, 30_000)
    return () => clearInterval(id)
  }, [task.status, task.scheduled_at])

  return <span>{label}</span>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function QueuePage() {
  const queue        = useFarmStore((s) => s.queue)
  const queueLoading = useFarmStore((s) => s.queueLoading)
  const fetchQueue   = useFarmStore((s) => s.fetchQueue)

  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    fetchQueue()
    const id = setInterval(fetchQueue, 10_000)
    return () => clearInterval(id)
  }, [fetchQueue])

  const filtered = filter === 'all'
    ? queue
    : queue.filter((t) => t.status === filter)

  const counts = {
    scheduled:   queue.filter((t) => t.status === 'scheduled').length,
    in_progress: queue.filter((t) => t.status === 'in_progress').length,
    published:   queue.filter((t) => t.status === 'published').length,
    failed:      queue.filter((t) => t.status === 'failed').length,
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>Очередь</div>
          <div className={styles.subtitle}>
            {queueLoading ? 'загрузка…' : (
              <>
                <span className={styles.cnt}>
                  {counts.scheduled} запланировано
                </span>
                {' · '}
                <span className={styles.cntGreen}>
                  {counts.published} опубликовано
                </span>
                {counts.failed > 0 && (
                  <>
                    {' · '}
                    <span className={styles.cntRed}>
                      {counts.failed} ошибок
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <button className={styles.syncBtn} onClick={fetchQueue}>
          обновить
        </button>
      </header>

      {/* Filters */}
      <div className={styles.filters}>
        {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {FILTER_LABELS[f]}
            {f !== 'all' && (
              <span className={styles.filterCount}>
                {queue.filter((t) => t.status === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 && !queueLoading ? (
        <div className={styles.empty}>— задач нет</div>
      ) : (
        <div className={styles.list}>
          {filtered.map((task) => (
            <div
              key={task.task_id}
              className={`${styles.row} ${task.status === 'in_progress' ? styles.rowActive : ''}`}
            >
              {/* Status dot */}
              <span
                className={styles.dot}
                style={{
                  background: STATUS_COLOR[task.status],
                  boxShadow: task.status === 'in_progress'
                    ? `0 0 8px ${STATUS_COLOR[task.status]}`
                    : 'none',
                }}
              />

              {/* Account */}
              <span className={styles.accountId}>{task.account_id}</span>

              {/* Status text / countdown */}
              <span
                className={styles.statusText}
                style={{ color: STATUS_COLOR[task.status] }}
              >
                <Countdown task={task} />
              </span>

              {/* Scheduled time */}
              <span className={styles.time}>{formatTime(task.scheduled_at)}</span>

              {/* Source badge */}
              <span
                className={styles.source}
                style={{
                  color: task.source_service === 'sportzavod'
                    ? 'rgba(34,197,94,0.5)'
                    : 'rgba(56,189,248,0.5)',
                  borderColor: task.source_service === 'sportzavod'
                    ? 'rgba(34,197,94,0.15)'
                    : 'rgba(56,189,248,0.15)',
                }}
              >
                {task.source_service}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
