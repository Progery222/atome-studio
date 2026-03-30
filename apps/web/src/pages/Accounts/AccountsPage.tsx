import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Account } from '@atome/shared'
import { useFarmStore } from '../../stores/farm'
import { CreateAccountModal } from './CreateAccountModal'
import styles from './AccountsPage.module.css'

const STATUS_COLOR: Record<Account['status'], string> = {
  active: '#22c55e',
  warmup: '#fbbf24',
  paused: '#60a5fa',
  banned: '#ef4444',
}

export function AccountsPage() {
  const accounts        = useFarmStore((s) => s.accounts)
  const phones          = useFarmStore((s) => s.phones)
  const accountsLoading = useFarmStore((s) => s.accountsLoading)
  const fetchAccounts   = useFarmStore((s) => s.fetchAccounts)
  const fetchPhones     = useFarmStore((s) => s.fetchPhones)
  const navigate        = useNavigate()

  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetchAccounts()
    fetchPhones()
    const id = setInterval(fetchAccounts, 30_000)
    return () => clearInterval(id)
  }, [fetchAccounts, fetchPhones])

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
        <button className={styles.createBtn} onClick={() => setShowModal(true)}>
          + Создать
        </button>
      </header>

      {accounts.length === 0 && !accountsLoading ? (
        <div className={styles.empty}>— нет аккаунтов · orchestrator недоступен</div>
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
            {accounts.map((acc) => (
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
