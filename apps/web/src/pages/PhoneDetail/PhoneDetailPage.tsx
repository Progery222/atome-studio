import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useFarmStore } from '../../stores/farm'

const s: Record<string, React.CSSProperties> = {
  page:    { padding: '28px 32px', fontFamily: "'Courier New', monospace" },
  back:    { fontSize: 8, letterSpacing: '0.14em', color: 'rgba(55,115,195,0.5)', textDecoration: 'none', textTransform: 'uppercase' },
  title:   { fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(80,160,255,0.6)', fontWeight: 700, margin: '12px 0 4px' },
  sub:     { fontSize: 8.5, color: 'rgba(55,115,195,0.35)', marginBottom: 24 },
  card:    { background: 'rgba(5,14,40,0.72)', border: '1px solid rgba(22,62,140,0.2)', borderRadius: 10, padding: 16 },
  row:     { display: 'flex', justifyContent: 'space-between', marginBottom: 10 },
  label:   { fontSize: 7.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(55,115,195,0.4)' },
  value:   { fontSize: 9, color: 'rgba(145,192,232,0.8)' },
  empty:   { fontSize: 9, color: 'rgba(55,115,195,0.3)', padding: '40px 0' },
}

export function PhoneDetailPage() {
  const { id }        = useParams<{ id: string }>()
  const phones        = useFarmStore((s) => s.phones)
  const fetchPhones   = useFarmStore((s) => s.fetchPhones)
  const phonesLoading = useFarmStore((s) => s.phonesLoading)

  useEffect(() => {
    if (phones.length === 0) fetchPhones()
  }, [phones.length, fetchPhones])

  const phone = phones.find((p) => p.phone_id === id)

  if (phonesLoading) return <div style={s.page}><div style={s.empty}>загрузка...</div></div>
  if (!phone)        return (
    <div style={s.page}>
      <Link to="/phones" style={s.back}>← Телефоны</Link>
      <div style={s.empty}>— телефон {id} не найден</div>
    </div>
  )

  return (
    <div style={s.page}>
      <Link to="/phones" style={s.back}>← Телефоны</Link>
      <div style={s.title}>{phone.serial || phone.phone_id}</div>
      <div style={s.sub}>{phone.model}</div>

      <div style={s.card}>
        {[
          ['Статус',       phone.status],
          ['Health score', `${phone.health_score}%`],
          ['Warmup day',   String(phone.warmup_day)],
          ['Посты сегодня', String(phone.posts_today)],
          ['Действия сегодня', String(phone.actions_today)],
          ['ADB',          phone.adb_connected ? 'connected' : 'disconnected'],
          ['Группа',       phone.group || '—'],
          ['Последняя активность', phone.last_active || '—'],
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
