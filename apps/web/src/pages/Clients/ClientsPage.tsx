import { useEffect, useState } from 'react'
import styles from './ClientsPage.module.css'

type Plan = 'basic' | 'pro' | 'enterprise'

interface Client {
  id:            string
  name:          string
  email:         string
  plan:          Plan
  phones_limit:  number
  phones_used:   number
  accounts_used: number
  status:        'active' | 'suspended'
}

const PLAN_COLOR: Record<Plan, string> = {
  basic:      'rgba(96, 165, 250, 0.55)',
  pro:        'rgba(167, 139, 250, 0.55)',
  enterprise: 'rgba(251, 191, 36, 0.55)',
}

interface CreateForm {
  name:         string
  email:        string
  plan:         Plan
  phones_limit: string
}

const EMPTY_FORM: CreateForm = {
  name:         '',
  email:        '',
  plan:         'basic',
  phones_limit: '5',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ClientsPage() {
  const [clients,   setClients]   = useState<Client[]>([])
  const [loading,   setLoading]   = useState(false)
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState<CreateForm>(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [formError, setFormError] = useState('')

  const fetchClients = async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/clients')
      const data = await res.json() as Client[]
      setClients(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setFormError('Заполните имя и email')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const res = await fetch('/api/clients', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:         form.name,
          email:        form.email,
          plan:         form.plan,
          phones_limit: Number(form.phones_limit) || 5,
        }),
      })
      if (!res.ok) throw new Error('error')
      const created = await res.json() as Client
      setClients((prev) => [...prev, created])
      setShowForm(false)
      setForm(EMPTY_FORM)
    } catch {
      setFormError('Ошибка создания клиента')
    } finally {
      setSaving(false)
    }
  }

  const subtitle = loading
    ? 'загрузка…'
    : clients.length > 0
      ? `${clients.length} клиентов`
      : 'нет данных'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>Клиенты</div>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>
        <button
          className={styles.createBtn}
          onClick={() => { setShowForm((s) => !s); setFormError('') }}
        >
          {showForm ? '✕ Отмена' : '+ Создать клиента'}
        </button>
      </header>

      {/* Inline create form */}
      {showForm && (
        <div className={styles.formCard}>
          <div className={styles.formTitle}>Новый клиент</div>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Имя</span>
              <input
                className={styles.input}
                type="text"
                value={form.name}
                placeholder="Название компании"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Email</span>
              <input
                className={styles.input}
                type="email"
                value={form.email}
                placeholder="client@example.com"
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Тариф</span>
              <select
                className={styles.input}
                value={form.plan}
                onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value as Plan }))}
              >
                <option value="basic">basic</option>
                <option value="pro">pro</option>
                <option value="enterprise">enterprise</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Лимит телефонов</span>
              <input
                className={styles.input}
                type="number"
                min="1"
                max="100"
                value={form.phones_limit}
                onChange={(e) => setForm((f) => ({ ...f, phones_limit: e.target.value }))}
              />
            </label>
          </div>
          {formError && <div className={styles.formError}>{formError}</div>}
          <div className={styles.formActions}>
            <button
              className={styles.saveBtn}
              onClick={handleCreate}
              disabled={saving}
            >
              {saving ? 'Создание…' : 'Создать →'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {clients.length === 0 && !loading ? (
        <div className={styles.empty}>— клиентов нет</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              {['Клиент', 'Email', 'Тариф', 'Телефонов', 'Аккаунтов', 'Статус'].map((h) => (
                <th key={h} className={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className={styles.tr}>
                <td className={styles.td}>
                  <span className={styles.clientName}>{client.name}</span>
                </td>
                <td className={styles.td}>
                  <span className={styles.email}>{client.email}</span>
                </td>
                <td className={styles.td}>
                  <span
                    className={styles.planBadge}
                    style={{ color: PLAN_COLOR[client.plan], borderColor: PLAN_COLOR[client.plan].replace('0.55', '0.15') }}
                  >
                    {client.plan}
                  </span>
                </td>
                <td className={styles.td}>
                  <span className={styles.num}>{client.phones_used ?? 0}</span>
                  <span className={styles.limit}> / {client.phones_limit}</span>
                </td>
                <td className={styles.td}>
                  <span className={styles.num}>{client.accounts_used ?? 0}</span>
                </td>
                <td className={styles.td}>
                  <span
                    className={styles.statusDot}
                    style={{ background: client.status === 'active' ? '#22c55e' : '#ef4444' }}
                  />
                  <span style={{ color: client.status === 'active' ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)' }}>
                    {client.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
