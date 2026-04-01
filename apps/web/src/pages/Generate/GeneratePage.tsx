import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Account, GenerationJob, GenerationScope, SportZavodTheme } from '@atome/shared'
import { useFarmStore } from '../../stores/farm'
import styles from './GeneratePage.module.css'

type Service = 'sportzavod' | 'contentzavod'
type VideoCount = 1 | 2 | 3 | 5

// ─── Progress Screen ──────────────────────────────────────────────────────────

function ProgressScreen({
  job,
  onBack,
}: {
  job: GenerationJob
  onBack: () => void
}) {
  const accounts  = useFarmStore((s) => s.sportzavodAccounts)
  const fetchJobs = useFarmStore((s) => s.fetchJobs)
  const activeJobs = useFarmStore((s) => s.activeJobs)
  const stopJob   = useFarmStore((s) => s.stopJob)
  const navigate  = useNavigate()

  const liveJob = activeJobs.find((j) => j.job_id === job.job_id) ?? job

  useEffect(() => {
    fetchJobs()
    const id = setInterval(fetchJobs, 3_000)
    return () => clearInterval(id)
  }, [fetchJobs])

  const accountMap = new Map(accounts.map((a) => [a.account_id, a]))
  const pct = liveJob.total > 0 ? Math.round((liveJob.progress / liveJob.total) * 100) : 0

  const statusColor =
    liveJob.status === 'error'   ? '#ef4444' :
    liveJob.status === 'stopped' ? '#fbbf24' :
    liveJob.status === 'done'    ? '#22c55e' :
    'rgba(0,210,255,0.8)'

  const statusText =
    liveJob.status === 'running'  ? 'Выполняется' :
    liveJob.status === 'stopping' ? 'Останавливается' :
    liveJob.status === 'done'     ? 'Завершено' :
    liveJob.status === 'stopped'  ? 'Остановлено' :
    'Ошибка'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>
            <button className={styles.backBtn} onClick={onBack}>&larr;</button>
            Задача {liveJob.job_id.slice(0, 8)}
          </div>
          <div className={styles.subtitle}>
            {liveJob.service}
            {liveJob.is_auto && <span className={styles.tagAuto}>АВТО</span>}
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.btnDanger}
            onClick={() => stopJob(liveJob.job_id)}
            disabled={liveJob.status !== 'running'}
          >
            Остановить
          </button>
          <button className={styles.btnGhost} onClick={() => navigate('/queue')}>
            Очередь &rarr;
          </button>
        </div>
      </header>

      {/* ── Big progress card ── */}
      <div className={styles.card}>
        <div className={styles.progressTop}>
          <div className={styles.progressStatusRow}>
            <span className={styles.progressDot} style={{ background: statusColor }} />
            <span className={styles.progressStatusText} style={{ color: statusColor }}>
              {statusText}
            </span>
          </div>
          <span className={styles.progressPct} style={{ color: statusColor }}>{pct}%</span>
        </div>
        <div className={styles.progressBarWrap}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${pct}%`, background: statusColor }}
          />
        </div>
        <div className={styles.metaRow}>
          <div className={styles.metaCell}>
            <span className={styles.metaLabel}>Видео/акк</span>
            <span className={styles.metaValue}>{liveJob.videos_per_account}</span>
          </div>
          <div className={styles.metaCell}>
            <span className={styles.metaLabel}>Прогресс</span>
            <span className={styles.metaValue}>{liveJob.progress} / {liveJob.total}</span>
          </div>
          {liveJob.errors_count > 0 && (
            <div className={styles.metaCell}>
              <span className={styles.metaLabel}>Ошибки</span>
              <span className={styles.metaValue} style={{ color: '#ef4444' }}>{liveJob.errors_count}</span>
            </div>
          )}
          {liveJob.topic && (
            <div className={styles.metaCell}>
              <span className={styles.metaLabel}>Тема</span>
              <span className={styles.metaValue}>{liveJob.topic}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Accounts in job ── */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Аккаунты ({liveJob.account_ids.length})</div>
        <div className={styles.progressAccountList}>
          {liveJob.account_ids.map((id) => {
            const acc    = accountMap.get(id)
            const result = liveJob.results?.find((r) => r.account_id === id)
            return (
              <div key={id} className={styles.progressAccountRow}>
                <span className={styles.dot} style={{ background: result ? '#22c55e' : 'rgba(255,255,255,0.1)' }} />
                <span className={styles.progressAccName}>{acc ? `@${acc.username}` : id}</span>
                {acc?.niche && <span className={styles.progressAccNiche}>{acc.niche}</span>}
                {result && (
                  <a href={result.video_url} target="_blank" rel="noreferrer" className={styles.videoLink}>
                    video &nearr;
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

// ─── Main page ────────────────────────────────────────────────────────────────

export function GeneratePage() {
  const accounts                  = useFarmStore((s) => s.accounts)
  const accountsLoading           = useFarmStore((s) => s.accountsLoading)
  const fetchAccounts             = useFarmStore((s) => s.fetchAccounts)
  const sportzavodAccounts        = useFarmStore((s) => s.sportzavodAccounts)
  const sportzavodAccountsLoading = useFarmStore((s) => s.sportzavodAccountsLoading)
  const fetchSportzavodAccounts   = useFarmStore((s) => s.fetchSportzavodAccounts)
  const sportzavodThemes          = useFarmStore((s) => s.sportzavodThemes)
  const fetchSportzavodThemes     = useFarmStore((s) => s.fetchSportzavodThemes)
  const startGeneration           = useFarmStore((s) => s.startGeneration)
  const startAutoGeneration       = useFarmStore((s) => s.startAutoGeneration)
  const reloadFromSheets          = useFarmStore((s) => s.reloadFromSheets)
  const activeJobs                = useFarmStore((s) => s.activeJobs)
  const fetchJobs                 = useFarmStore((s) => s.fetchJobs)
  const stopJob                   = useFarmStore((s) => s.stopJob)
  const stopAllJobs               = useFarmStore((s) => s.stopAllJobs)

  const [service, setService]         = useState<Service>('sportzavod')
  const [scope, setScope]             = useState<GenerationScope | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [videosPerAcc, setVideosPerAcc] = useState<VideoCount>(1)
  const [topic, setTopic]             = useState('')
  const [nicheFilter, setNicheFilter] = useState<string | null>(null)
  const [nicheOpen, setNicheOpen]     = useState(false)
  const [launching, setLaunching]     = useState(false)
  const [viewingJob, setViewingJob]   = useState<GenerationJob | null>(null)
  const [reloading, setReloading]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [scopeLabel, setScopeLabel]   = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Account[] | null>(null)
  const [accountInput, setAccountInput] = useState('')
  const [accountError, setAccountError] = useState('')
  const nicheRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (service === 'sportzavod') {
      fetchSportzavodAccounts()
      fetchSportzavodThemes()
    } else {
      fetchAccounts()
    }
  }, [service, fetchAccounts, fetchSportzavodAccounts, fetchSportzavodThemes])

  useEffect(() => {
    fetchJobs()
    const id = setInterval(fetchJobs, 5_000)
    return () => clearInterval(id)
  }, [fetchJobs])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (nicheRef.current && !nicheRef.current.contains(e.target as Node)) setNicheOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activeAccounts = service === 'sportzavod' ? sportzavodAccounts : accounts
  const isLoading      = service === 'sportzavod' ? sportzavodAccountsLoading : accountsLoading
  const readyAccounts  = activeAccounts.filter((a) => a.heygen_avatar_id)
  const allNiches      = [...new Set(activeAccounts.map((a) => a.niche).filter(Boolean))]
  const visibleAccounts = nicheFilter ? activeAccounts.filter((a) => a.niche === nicheFilter) : activeAccounts
  const runningJobs    = activeJobs.filter((j) => j.status === 'running' || j.status === 'stopping')
  const withAvatar     = activeAccounts.filter((a) => a.heygen_avatar_id).length
  const withoutAvatar  = activeAccounts.length - withAvatar

  const toggleAll = () => {
    if (selectedIds.size === visibleAccounts.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(visibleAccounts.map((a) => a.account_id)))
  }

  const toggleAccount = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Scope handlers ──

  const handleScopeAll = useCallback(() => {
    const ids = readyAccounts.map((a) => a.account_id)
    setSelectedIds(new Set(ids))
    setScopeLabel(`Все аккаунты (${ids.length})`)
    setScope(null)
    setShowConfirm(true)
  }, [readyAccounts])

  const handleScopeTheme = useCallback((themeKey: string) => {
    const ids = activeAccounts
      .filter((a) => a.niche === themeKey && a.heygen_avatar_id)
      .map((a) => a.account_id)
    setSelectedIds(new Set(ids))
    setScopeLabel(`${themeKey} (${ids.length} акк.)`)
    setScope(null)
    setShowConfirm(true)
  }, [activeAccounts])

  const handleSearch = () => {
    if (!searchQuery.trim()) return
    const lower = searchQuery.toLowerCase()
    const found = activeAccounts.filter(
      (a) => a.username.toLowerCase().includes(lower) || a.niche.toLowerCase().includes(lower) || a.account_id.toLowerCase().includes(lower)
    )
    setSearchResults(found)
  }

  const handleSearchSelect = (accs: Account[]) => {
    const ids = accs.map((a) => a.account_id)
    setSelectedIds(new Set(ids))
    setScopeLabel(`Поиск: ${searchQuery} (${ids.length} акк.)`)
    setScope(null)
    setSearchResults(null)
    setSearchQuery('')
    setShowConfirm(true)
  }

  const handleAccountSubmit = () => {
    const val = accountInput.trim()
    if (!val) return
    const acc = activeAccounts.find(
      (a) => a.account_id === val || a.username.toLowerCase() === val.toLowerCase()
    )
    if (!acc) { setAccountError(`"${val}" не найден`); return }
    if (!acc.heygen_avatar_id) { setAccountError(`@${acc.username} — нет avatar_id`); return }
    setSelectedIds(new Set([acc.account_id]))
    setScopeLabel(`@${acc.username}`)
    setScope(null)
    setAccountInput('')
    setAccountError('')
    setShowConfirm(true)
  }

  const handleLaunch = async () => {
    if (selectedIds.size === 0 || launching) return
    setLaunching(true)
    const job = await startGeneration({
      service,
      account_ids: [...selectedIds],
      videos_per_account: videosPerAcc,
      topic: service === 'contentzavod' ? topic : undefined,
    })
    setLaunching(false)
    if (job) { setViewingJob(job); setShowConfirm(false) }
  }

  const handleAutoMode = async () => {
    setLaunching(true)
    const job = await startAutoGeneration(selectedIds.size > 0 ? [...selectedIds] : undefined)
    setLaunching(false)
    if (job) setViewingJob(job)
  }

  const handleReload = async () => {
    setReloading(true)
    await reloadFromSheets()
    if (service === 'sportzavod') { await fetchSportzavodAccounts(); await fetchSportzavodThemes() }
    setReloading(false)
  }

  // ── Progress screen ──
  if (viewingJob) return <ProgressScreen job={viewingJob} onBack={() => setViewingJob(null)} />

  // ── Confirmation overlay ──
  if (showConfirm) {
    const total = selectedIds.size * videosPerAcc
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <div className={styles.title}>
              <button className={styles.backBtn} onClick={() => { setShowConfirm(false); setSelectedIds(new Set()) }}>&larr;</button>
              Подтверждение запуска
            </div>
            <div className={styles.subtitle}>проверьте параметры</div>
          </div>
        </header>
        <div className={styles.confirmCard}>
          <div className={styles.confirmGrid}>
            <div className={styles.confirmCell}>
              <span className={styles.confirmCellLabel}>Скоуп</span>
              <span className={styles.confirmCellValue}>{scopeLabel}</span>
            </div>
            <div className={styles.confirmCell}>
              <span className={styles.confirmCellLabel}>Видео / акк</span>
              <span className={styles.confirmCellValue}>{videosPerAcc}</span>
            </div>
            <div className={styles.confirmCell}>
              <span className={styles.confirmCellLabel}>Аккаунтов</span>
              <span className={styles.confirmCellValue}>{selectedIds.size}</span>
            </div>
            <div className={`${styles.confirmCell} ${styles.confirmCellHighlight}`}>
              <span className={styles.confirmCellLabel}>Итого видео</span>
              <span className={styles.confirmCellBig}>{total}</span>
            </div>
          </div>
          <div className={styles.confirmActions}>
            <button className={styles.launchBtn} onClick={handleLaunch} disabled={launching}>
              {launching ? 'Запуск...' : 'Запустить генерацию'}
            </button>
            <button className={styles.btnGhost} onClick={() => { setShowConfirm(false); setSelectedIds(new Set()) }}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main layout ──
  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div>
          <div className={styles.title}>Генерация</div>
          <div className={styles.subtitle}>запуск видеогенерации через SportZavod / content-zavod</div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnGhost} onClick={handleReload} disabled={reloading}>
            {reloading ? 'Загрузка...' : 'Обновить GSheet'}
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        {/* ════════════ LEFT COLUMN ════════════ */}
        <div className={styles.colMain}>

          {/* ── 1. Service toggle ── */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Сервис</div>
            <div className={styles.serviceTabs}>
              {(['sportzavod', 'contentzavod'] as Service[]).map((svc) => (
                <button
                  key={svc}
                  className={`${styles.serviceTab} ${service === svc ? styles.serviceTabActive : ''}`}
                  onClick={() => { setService(svc); setSelectedIds(new Set()); setNicheFilter(null); setScope(null) }}
                >
                  <span className={styles.serviceTabDot} style={{ background: svc === 'sportzavod' ? '#d4af37' : '#b496ff' }} />
                  {svc === 'sportzavod' ? 'SportZavod' : 'content-zavod'}
                </button>
              ))}
            </div>

            {/* Stats bar */}
            {service === 'sportzavod' && activeAccounts.length > 0 && (
              <div className={styles.statsBar}>
                <div className={styles.stat}>
                  <span className={styles.statNum}>{activeAccounts.length}</span>
                  <span className={styles.statLabel}>аккаунтов</span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                  <span className={styles.statNum} style={{ color: '#22c55e' }}>{withAvatar}</span>
                  <span className={styles.statLabel}>с аватаром</span>
                </div>
                {withoutAvatar > 0 && (
                  <>
                    <div className={styles.statDivider} />
                    <div className={styles.stat}>
                      <span className={styles.statNum} style={{ color: '#fbbf24' }}>{withoutAvatar}</span>
                      <span className={styles.statLabel}>без аватара</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── 2. Scope selection (SportZavod) ── */}
          {service === 'sportzavod' && !scope && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Для кого генерировать?</div>
              <div className={styles.scopeGrid}>
                <button className={styles.scopeCard} onClick={handleScopeAll}>
                  <span className={styles.scopeCardIcon}>*</span>
                  <div className={styles.scopeCardText}>
                    <span className={styles.scopeCardTitle}>Все аккаунты</span>
                    <span className={styles.scopeCardSub}>{readyAccounts.length} готовых</span>
                  </div>
                </button>
                <button className={styles.scopeCard} onClick={() => setScope('theme')}>
                  <span className={styles.scopeCardIcon}>#</span>
                  <div className={styles.scopeCardText}>
                    <span className={styles.scopeCardTitle}>По теме</span>
                    <span className={styles.scopeCardSub}>{sportzavodThemes.length} тем</span>
                  </div>
                </button>
                <button className={styles.scopeCard} onClick={() => setScope('account')}>
                  <span className={styles.scopeCardIcon}>@</span>
                  <div className={styles.scopeCardText}>
                    <span className={styles.scopeCardTitle}>Аккаунт</span>
                    <span className={styles.scopeCardSub}>по ID / username</span>
                  </div>
                </button>
                <button className={styles.scopeCard} onClick={() => setScope('query')}>
                  <span className={styles.scopeCardIcon}>?</span>
                  <div className={styles.scopeCardText}>
                    <span className={styles.scopeCardTitle}>Поиск</span>
                    <span className={styles.scopeCardSub}>NBA, MMA, F1...</span>
                  </div>
                </button>
              </div>
              <button className={styles.autoBtn} onClick={handleAutoMode} disabled={launching}>
                {launching ? 'Запуск...' : 'Авто-режим — непрерывная генерация'}
              </button>
            </div>
          )}

          {/* ── 2a. Theme picker ── */}
          {scope === 'theme' && (
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <button className={styles.backBtnSmall} onClick={() => setScope(null)}>&larr;</button>
                <div className={styles.cardTitle}>Выберите тему</div>
              </div>
              <div className={styles.themeGrid}>
                {sportzavodThemes.map((t) => (
                  <button key={t.theme_key} className={styles.themeChip} onClick={() => handleScopeTheme(t.theme_key)}>
                    {t.theme_key}
                    <span className={styles.themeChipCount}>{t.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── 2b. Search ── */}
          {scope === 'query' && (
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <button className={styles.backBtnSmall} onClick={() => { setScope(null); setSearchResults(null); setSearchQuery('') }}>&larr;</button>
                <div className={styles.cardTitle}>Поиск аккаунтов</div>
              </div>
              <div className={styles.inputRow}>
                <input
                  className={styles.input}
                  placeholder="NBA, NFL, soccer, MMA, F1, boxing..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button className={styles.btnPrimary} onClick={handleSearch}>Найти</button>
              </div>
              {searchResults !== null && searchResults.length === 0 && (
                <div className={styles.emptySmall}>Ничего не найдено</div>
              )}
              {searchResults && searchResults.length > 0 && (
                <div className={styles.searchResult}>
                  <span>{searchResults.length} аккаунтов: {[...new Set(searchResults.map((a) => a.niche))].join(', ')}</span>
                  <button className={styles.btnPrimary} onClick={() => handleSearchSelect(searchResults)}>
                    Выбрать ({searchResults.length})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── 2c. Account ID input ── */}
          {scope === 'account' && (
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <button className={styles.backBtnSmall} onClick={() => { setScope(null); setAccountInput(''); setAccountError('') }}>&larr;</button>
                <div className={styles.cardTitle}>Конкретный аккаунт</div>
              </div>
              <div className={styles.inputRow}>
                <input
                  className={styles.input}
                  placeholder="ID или @username"
                  value={accountInput}
                  onChange={(e) => { setAccountInput(e.target.value); setAccountError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAccountSubmit()}
                />
                <button className={styles.btnPrimary} onClick={handleAccountSubmit}>Выбрать</button>
              </div>
              {accountError && <div className={styles.errorText}>{accountError}</div>}
            </div>
          )}

          {/* ── 3. Settings row ── */}
          <div className={styles.settingsRow}>
            <div className={styles.cardSmall}>
              <div className={styles.cardTitle}>Видео / аккаунт</div>
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
            {service === 'contentzavod' && (
              <div className={styles.cardSmall} style={{ flex: 1 }}>
                <div className={styles.cardTitle}>Тема</div>
                <input
                  className={styles.input}
                  placeholder="введите тему..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* ── 4. Account list ── */}
          <div className={styles.card}>
            <div className={styles.cardTitleRow}>
              <div className={styles.cardTitle}>
                Аккаунты
                {isLoading && <span className={styles.loading}> загрузка...</span>}
              </div>
              <span className={styles.selBadge}>{selectedIds.size} выбрано</span>
            </div>

            <div className={styles.filterRow}>
              <button
                className={`${styles.filterChip} ${nicheFilter === null ? styles.filterChipActive : ''}`}
                onClick={() => { setNicheFilter(null); setNicheOpen(false) }}
              >
                Все
              </button>
              <div className={styles.nicheDropdown} ref={nicheRef}>
                <button
                  className={`${styles.filterChip} ${nicheFilter !== null ? styles.filterChipActive : ''}`}
                  onClick={() => setNicheOpen((o) => !o)}
                >
                  {nicheFilter || 'Ниша'}
                </button>
                {nicheOpen && allNiches.length > 0 && (
                  <div className={styles.nicheMenu}>
                    {allNiches.map((n) => (
                      <button key={n} className={styles.nicheItem} onClick={() => { setNicheFilter(n); setNicheOpen(false) }}>
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className={styles.filterChip} onClick={toggleAll}>
                {selectedIds.size === visibleAccounts.length && visibleAccounts.length > 0 ? 'Снять все' : 'Выбрать все'}
              </button>
            </div>

            <div className={styles.accountList}>
              {visibleAccounts.length === 0 && !isLoading && (
                <div className={styles.emptySmall}>Нет аккаунтов. Нажмите "Обновить GSheet".</div>
              )}
              {visibleAccounts.map((acc) => (
                <label key={acc.account_id} className={styles.accRow}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(acc.account_id)}
                    onChange={() => toggleAccount(acc.account_id)}
                    className={styles.checkbox}
                  />
                  <span className={`${styles.accAvatarBadge} ${acc.heygen_avatar_id ? styles.accAvatarOk : styles.accAvatarNo}`}>
                    {acc.heygen_avatar_id ? 'A' : '-'}
                  </span>
                  <span className={styles.accName}>@{acc.username}</span>
                  <span className={styles.accNiche}>{acc.niche}</span>
                  <span className={styles.accStatus} style={{
                    color: acc.status === 'active' ? '#22c55e' : acc.status === 'banned' ? '#ef4444' : '#fbbf24',
                  }}>
                    {acc.status}
                  </span>
                </label>
              ))}
            </div>

            {/* Launch from manual selection */}
            <div className={styles.cardFooter}>
              <button
                className={styles.launchBtn}
                disabled={selectedIds.size === 0 || launching}
                onClick={() => {
                  if (selectedIds.size === 0) return
                  setScopeLabel(`Выбрано вручную (${selectedIds.size})`)
                  setShowConfirm(true)
                }}
              >
                {launching ? 'Запуск...' : `Запустить (${selectedIds.size})`}
              </button>
            </div>
          </div>
        </div>

        {/* ════════════ RIGHT COLUMN ════════════ */}
        <div className={styles.colSide}>

          {/* ── Active Jobs ── */}
          <div className={styles.card}>
            <div className={styles.cardTitleRow}>
              <div className={styles.cardTitle}>Задачи</div>
              {runningJobs.length > 1 && (
                <button className={styles.btnDangerSmall} onClick={() => stopAllJobs()}>Стоп все</button>
              )}
            </div>

            {activeJobs.length === 0 ? (
              <div className={styles.emptySmall}>Нет активных задач</div>
            ) : (
              <div className={styles.jobList}>
                {activeJobs.slice(-8).reverse().map((j) => {
                  const jColor =
                    j.status === 'running'  ? '#22c55e' :
                    j.status === 'stopping' ? '#fbbf24' :
                    j.status === 'done'     ? 'rgba(34,197,94,0.3)' :
                    j.status === 'stopped'  ? 'rgba(251,191,36,0.3)' :
                    'rgba(239,68,68,0.5)'
                  const jPct = j.total > 0 ? Math.round((j.progress / j.total) * 100) : 0
                  return (
                    <div key={j.job_id} className={styles.jobItem} onClick={() => setViewingJob(j)}>
                      <div className={styles.jobItemTop}>
                        <span className={styles.dot} style={{ background: jColor }} />
                        <span className={styles.jobItemId}>{j.job_id.slice(0, 8)}</span>
                        {j.is_auto && <span className={styles.tagAuto}>АВТО</span>}
                        <span className={styles.jobItemPct}>{jPct}%</span>
                      </div>
                      <div className={styles.jobItemBar}>
                        <div className={styles.jobItemBarFill} style={{ width: `${jPct}%`, background: jColor }} />
                      </div>
                      <div className={styles.jobItemBottom}>
                        <span>{j.progress}/{j.total}</span>
                        {j.errors_count > 0 && <span style={{ color: '#ef4444' }}>{j.errors_count} ош.</span>}
                        {j.status === 'running' && (
                          <button
                            className={styles.btnDangerSmall}
                            onClick={(e) => { e.stopPropagation(); stopJob(j.job_id) }}
                          >
                            Стоп
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
