import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Account } from '@atome/shared'
import { useFarmStore }  from '../../stores/farm'
import { useAuthStore }  from '../../stores/auth'
import { CreateAccountModal } from './CreateAccountModal'
import styles from './AccountsPage.module.css'

const STATUS_COLOR: Record<Account['status'], string> = {
  active: '#22c55e',
  warmup: '#fbbf24',
  paused: '#60a5fa',
  banned: '#ef4444',
}

const ALL_STATUSES: Account['status'][] = ['active', 'warmup', 'paused', 'banned']

export function AccountsPage() {
  const accounts        = useFarmStore((s) => s.accounts)
  const phones          = useFarmStore((s) => s.phones)
  const accountsLoading = useFarmStore((s) => s.accountsLoading)
  const fetchAccounts   = useFarmStore((s) => s.fetchAccounts)
  const fetchPhones     = useFarmStore((s) => s.fetchPhones)
  const role            = useAuthStore((s) => s.role)
  const navigate        = useNavigate()
  const reloadFromSheets = useFarmStore((s) => s.reloadFromSheets)
  const canCreate        = role !== 'viewer'

  const [showModal, setShowModal]         = useState(false)
  const [importing, setImporting]         = useState(false)
  const [importResult, setImportResult]   = useState<'ok' | 'err' | null>(null)
  const [search, setSearch]               = useState('')
  const [nicheFilter, setNicheFilter]     = useState<string | 'all'>('all')
  const [statusFilter, setStatusFilter]   = useState<Account['status'] | 'all'>('all')

  useEffect(() => {
    fetchAccounts()
    fetchPhones()
    const id = setInterval(fetchAccounts, 30_000)
    return () => clearInterval(id)
  }, [fetchAccounts, fetchPhones])

  // Collect unique niches
  const niches = useMemo(
    () => [...new Set(accounts.map(a => a.niche).filter(Boolean))].sort(),
    [accounts]
  )

  // Filter
  const filtered = useMemo(() => {
    let list = accounts
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter)
    if (nicheFilter !== 'all') list = list.filter(a => a.niche === nicheFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.username.toLowerCase().includes(q) ||
        a.phone_id?.toLowerCase().includes(q) ||
        a.niche?.toLowerCase().includes(q)
      )
    }
    return list
  }, [accounts, statusFilter, nicheFilter, search])

  const subtitle = accountsLoading
    ? 'загрузка...'
    : accounts.length > 0
      ? `${accounts.length} аккаунтов · ${accounts.filter((a) => a.status === 'active').length} активных`
      : 'нет данных'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>Аккаунты</div>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>
        <div className={styles.headerActions}>
          {canCreate && (
            <button
              className={styles.importBtn}
              disabled={importing}
              onClick={async () => {
                setImporting(true)
                setImportResult(null)
                const ok = await reloadFromSheets()
                setImporting(false)
                setImportResult(ok ? 'ok' : 'err')
                setTimeout(() => setImportResult(null), 3000)
              }}
            >
              {importing ? '⟳ Импорт…' : '↓ GSheets'}
            </button>
          )}
          {importResult === 'ok' && (
            <span className={styles.importOk}>✓ Обновлено</span>
          )}
          {importResult === 'err' && (
            <span className={styles.importErr}>✗ Ошибка</span>
          )}
          {canCreate && (
            <button className={styles.createBtn} onClick={() => setShowModal(true)}>
              + Создать
            </button>
          )}
        </div>
      </header>

      {/* ── Filters (FR-6.3, FR-6.4) ── */}
      <div className={styles.filtersRow}>
        {/* Search */}
        <input
          type="text"
          className={styles.searchInput}
          placeholder="🔍 Поиск по username…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* Niche select */}
        <select
          className={styles.filterSelect}
          value={nicheFilter}
          onChange={e => setNicheFilter(e.target.value)}
        >
          <option value="all">Все ниши</option>
          {niches.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        {/* Status filter tabs */}
        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTab} ${statusFilter === 'all' ? styles.filterTabActive : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            Все
          </button>
          {ALL_STATUSES.map(st => {
            const cnt = accounts.filter(a => a.status === st).length
            return (
              <button
                key={st}
                className={`${styles.filterTab} ${statusFilter === st ? styles.filterTabActive : ''}`}
                onClick={() => setStatusFilter(st)}
                style={statusFilter === st ? { color: STATUS_COLOR[st] } : undefined}
              >
                {st}
                {cnt > 0 && <span className={styles.filterCount}>{cnt}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {filtered.length === 0 && !accountsLoading ? (
        <div className={styles.empty}>
          {accounts.length === 0
            ? '— нет аккаунтов · orchestrator недоступен'
            : '— ничего не найдено по фильтру'
          }
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              {['Username', 'Ниша', 'Статус', 'Health', 'Посты сег.', 'Посты всего', 'Телефон'].map((h) => (
                <th key={h} className={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((acc) => (
              <tr
                key={acc.account_id}
                className={styles.tr}
                onClick={() => navigate(`/accounts/${acc.account_id}`)}
              >
                <td className={styles.td}>
                  <span className={styles.username}>{acc.username}</span>
                </td>
                <td className={styles.td}>
                  <span className={styles.niche}>{acc.niche}</span>
                </td>
                <td className={styles.td}>
                  <span
                    className={styles.statusDot}
                    style={{ background: STATUS_COLOR[acc.status] }}
                  />
                  {acc.status}
                </td>
                <td className={styles.td}>{acc.health_score}%</td>
                <td className={styles.td}>{acc.stats?.posts_today ?? 0}</td>
                <td className={styles.td}>{acc.stats?.posts_total ?? 0}</td>
                <td className={styles.td} style={{ color: 'rgba(55,115,195,0.5)' }}>
                  {acc.phone_id || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <CreateAccountModal
          phones={phones}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
