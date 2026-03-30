import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Account, GenerationJob } from '@atome/shared'
import { useFarmStore } from '../../stores/farm'
import styles from './GeneratePage.module.css'

type Service = 'sportzavod' | 'contentzavod'
type VideoCount = 1 | 2 | 3 | 5

// ─── Progress Screen ──────────────────────────────────────────────────────────

function ProgressScreen({ job }: { job: GenerationJob }) {
  const accounts      = useFarmStore((s) => s.accounts)
  const fetchJobs     = useFarmStore((s) => s.fetchJobs)
  const activeJobs    = useFarmStore((s) => s.activeJobs)
  const stopJob       = useFarmStore((s) => s.stopJob)
  const navigate      = useNavigate()

  // Find latest version of this job from store
  const liveJob = activeJobs.find((j) => j.job_id === job.job_id) ?? job

  useEffect(() => {
    const id = setInterval(fetchJobs, 5_000)
    return () => clearInterval(id)
  }, [fetchJobs])

  const accountMap = new Map(accounts.map((a) => [a.account_id, a]))

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>Генерация</div>
          <div className={styles.subtitle}>
            {liveJob.service} · job {liveJob.job_id.slice(0, 8)}…
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.btnDanger}
            onClick={() => stopJob(liveJob.job_id)}
            disabled={liveJob.status !== 'running'}
          >
            Отмена
          </button>
          <button
            className={styles.btnSecondary}
            onClick={() => navigate('/queue')}
          >
            Перейти в очередь →
          </button>
        </div>
      </header>

      <div className={styles.progressCard}>
        <div className={styles.progressHeader}>
          <span className={styles.progressLabel}>
            {liveJob.status === 'running' && 'Выполняется…'}
            {liveJob.status === 'done'    && 'Завершено'}
            {liveJob.status === 'error'   && 'Ошибка'}
          </span>
          <span
            className={styles.progressPct}
            style={{ color: liveJob.status === 'error' ? '#ef4444' : 'rgba(34,197,94,0.8)' }}
          >
            {liveJob.progress}%
          </span>
        </div>
        <div className={styles.progressBarWrap}>
          <div
            className={styles.progressBarFill}
            style={{
              width: `${liveJob.progress}%`,
              background: liveJob.status === 'error'
                ? 'rgba(239,68,68,0.6)'
                : 'rgba(34,197,94,0.5)',
            }}
          />
        </div>

        <div className={styles.jobMeta}>
          <span className={styles.metaItem}>
            видео / акк: <strong>{liveJob.videos_per_account}</strong>
          </span>
          {liveJob.topic && (
            <span className={styles.metaItem}>
              тема: <strong>{liveJob.topic}</strong>
            </span>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Аккаунты</div>
        <div className={styles.accountList}>
          {liveJob.account_ids.map((id) => {
            const acc = accountMap.get(id)
            const result = liveJob.results?.find((r) => r.account_id === id)
            return (
              <div key={id} className={styles.accountRow}>
                <span className={styles.accountDot} style={{ background: result ? '#22c55e' : 'rgba(55,115,195,0.3)' }} />
                <span className={styles.accountName}>
                  {acc ? acc.username : id}
                </span>
                {result && (
                  <a
                    href={result.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.videoLink}
                  >
                    ↗ видео
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Generate Form ────────────────────────────────────────────────────────────

export function GeneratePage() {
  const accounts        = useFarmStore((s) => s.accounts)
  const accountsLoading = useFarmStore((s) => s.accountsLoading)
  const fetchAccounts   = useFarmStore((s) => s.fetchAccounts)
  const startGeneration = useFarmStore((s) => s.startGeneration)

  const [service,         setService]         = useState<Service>('sportzavod')
  const [selectedIds,     setSelectedIds]      = useState<Set<string>>(new Set())
  const [videosPerAcc,    setVideosPerAcc]     = useState<VideoCount>(1)
  const [topic,           setTopic]            = useState('')
  const [nicheFilter,     setNicheFilter]      = useState<string | null>(null)
  const [nicheOpen,       setNicheOpen]        = useState(false)
  const [launching,       setLaunching]        = useState(false)
  const [activeJob,       setActiveJob]        = useState<GenerationJob | null>(null)
  const nicheRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  // Close niche dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (nicheRef.current && !nicheRef.current.contains(e.target as Node)) {
        setNicheOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allNiches = [...new Set(accounts.map((a) => a.niche).filter(Boolean))]

  const visibleAccounts = nicheFilter
    ? accounts.filter((a) => a.niche === nicheFilter)
    : accounts

  const toggleAll = () => {
    if (selectedIds.size === visibleAccounts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleAccounts.map((a) => a.account_id)))
    }
  }

  const toggleAccount = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleLaunch = async () => {
    if (selectedIds.size === 0 || launching) return
    setLaunching(true)
    const job = await startGeneration({
      service,
      account_ids:        [...selectedIds],
      videos_per_account: videosPerAcc,
      topic:              service === 'contentzavod' ? topic : undefined,
    })
    setLaunching(false)
    if (job) setActiveJob(job)
  }

  if (activeJob) return <ProgressScreen job={activeJob} />

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>Генерация</div>
          <div className={styles.subtitle}>запуск видеогенерации через SportZavod / content-zavod</div>
        </div>
      </header>

      {/* Service selector */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Сервис</div>
        <div className={styles.radioGroup}>
          {(['sportzavod', 'contentzavod'] as Service[]).map((svc) => (
            <label key={svc} className={styles.radioLabel}>
              <input
                type="radio"
                name="service"
                value={svc}
                checked={service === svc}
                onChange={() => setService(svc)}
                className={styles.radioInput}
              />
              <span className={`${styles.radioBtn} ${service === svc ? styles.radioBtnActive : ''}`}>
                {svc === 'sportzavod' ? '▶ SportZavod' : '◆ content-zavod'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Videos per account */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Видео на аккаунт</div>
        <div className={styles.countGroup}>
          {([1, 2, 3, 5] as VideoCount[]).map((n) => (
            <button
              key={n}
              className={`${styles.countBtn} ${videosPerAcc === n ? styles.countBtnActive : ''}`}
              onClick={() => setVideosPerAcc(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Topic (contentzavod only) */}
      {service === 'contentzavod' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Тема</div>
          <input
            className={styles.topicInput}
            type="text"
            placeholder="введите тему для генерации…"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>
      )}

      {/* Accounts */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          Аккаунты
          {accountsLoading && <span className={styles.loading}> загрузка…</span>}
        </div>

        <div className={styles.accountFilters}>
          <button
            className={`${styles.filterBtn} ${nicheFilter === null ? styles.filterBtnActive : ''}`}
            onClick={() => { setNicheFilter(null); setNicheOpen(false) }}
          >
            Все
          </button>
          <div className={styles.nicheDropdown} ref={nicheRef}>
            <button
              className={`${styles.filterBtn} ${nicheFilter !== null ? styles.filterBtnActive : ''}`}
              onClick={() => setNicheOpen((o) => !o)}
            >
              {nicheFilter ? `Ниша: ${nicheFilter}` : 'По нише'} ▾
            </button>
            {nicheOpen && allNiches.length > 0 && (
              <div className={styles.nicheMenu}>
                {allNiches.map((n) => (
                  <button
                    key={n}
                    className={styles.nicheItem}
                    onClick={() => { setNicheFilter(n); setNicheOpen(false) }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className={styles.filterBtn} onClick={toggleAll}>
            {selectedIds.size === visibleAccounts.length && visibleAccounts.length > 0
              ? 'Снять все'
              : 'Выбрать все'}
          </button>
          <span className={styles.selCount}>{selectedIds.size} выбрано</span>
        </div>

        <div className={styles.accountCheckList}>
          {visibleAccounts.length === 0 && !accountsLoading && (
            <div className={styles.empty}>— нет аккаунтов</div>
          )}
          {visibleAccounts.map((acc) => (
            <label key={acc.account_id} className={styles.checkRow}>
              <input
                type="checkbox"
                checked={selectedIds.has(acc.account_id)}
                onChange={() => toggleAccount(acc.account_id)}
                className={styles.checkbox}
              />
              <span className={styles.checkUsername}>{acc.username}</span>
              <span className={styles.checkNiche}>{acc.niche}</span>
              <span
                className={styles.checkStatus}
                style={{ color: acc.status === 'active' ? '#22c55e' : acc.status === 'banned' ? '#ef4444' : '#fbbf24' }}
              >
                {acc.status}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Launch */}
      <div className={styles.launchRow}>
        <button
          className={styles.launchBtn}
          onClick={handleLaunch}
          disabled={selectedIds.size === 0 || launching}
        >
          {launching ? 'Запуск…' : `Запустить генерацию → (${selectedIds.size})`}
        </button>
      </div>
    </div>
  )
}
