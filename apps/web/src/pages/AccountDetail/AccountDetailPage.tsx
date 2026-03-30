import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useFarmStore } from '../../stores/farm'

const s: Record<string, React.CSSProperties> = {
  page:  { padding: '28px 32px', fontFamily: "'Courier New', monospace" },
  back:  { fontSize: 8, letterSpacing: '0.14em', color: 'rgba(55,115,195,0.5)', textDecoration: 'none', textTransform: 'uppercase' },
  title: { fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(80,160,255,0.6)', fontWeight: 700, margin: '12px 0 4px' },
  sub:   { fontSize: 8.5, color: 'rgba(55,115,195,0.35)', marginBottom: 24 },
  card:  { background: 'rgba(5,14,40,0.72)', border: '1px solid rgba(22,62,140,0.2)', borderRadius: 10, padding: 16 },
  row:   { display: 'flex', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontSize: 7.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(55,115,195,0.4)' },
  value: { fontSize: 9, color: 'rgba(145,192,232,0.8)' },
  empty: { fontSize: 9, color: 'rgba(55,115,195,0.3)', padding: '40px 0' },
}

export function AccountDetailPage() {
  const { id }          = useParams<{ id: string }>()
  const accounts        = useFarmStore((s) => s.accounts)
  const fetchAccounts   = useFarmStore((s) => s.fetchAccounts)
  const accountsLoading = useFarmStore((s) => s.accountsLoading)

  useEffect(() => {
    if (accounts.length === 0) fetchAccounts()
  }, [accounts.length, fetchAccounts])

  const acc = accounts.find((a) => a.account_id === id)

  if (accountsLoading) return <div style={s.page}><div style={s.empty}>загрузка...</div></div>
  if (!acc) return (
    <div style={s.page}>
      <Link to="/accounts" style={s.back}>← Аккаунты</Link>
      <div style={s.empty}>— аккаунт {id} не найден</div>
    </div>
  )

  return (
    <div style={s.page}>
      <Link to="/accounts" style={s.back}>← Аккаунты</Link>
      <div style={s.title}>@{acc.username}</div>
      <div style={s.sub}>{acc.niche} · {acc.platform}</div>

      <div style={s.card}>
        {[
          ['Статус',          acc.status],
          ['Health score',    `${acc.health_score}%`],
          ['Warmup day',      String(acc.warmup_day)],
          ['Телефон',         acc.phone_id || '—'],
          ['Посты сегодня',   String(acc.stats?.posts_today ?? 0)],
          ['Посты за неделю', String(acc.stats?.posts_week  ?? 0)],
          ['Посты всего',     String(acc.stats?.posts_total ?? 0)],
          ['Последний пост',  acc.stats?.last_post || '—'],
          ['Часовой пояс',    acc.timezone || '—'],
          ['Частота (ч)',     String(acc.post_frequency_hours)],
        ].map(([label, value]) => (
          <div key={label} style={s.row}>
            <span style={s.label}>{label}</span>
            <span style={s.value}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
