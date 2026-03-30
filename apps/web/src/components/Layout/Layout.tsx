import { NavLink, Outlet, Link } from 'react-router-dom'
import { useLangStore, Lang } from '../../stores/lang'
import { useT } from '../../i18n'
import styles from './Layout.module.css'

const LANGS: { code: Lang; label: string }[] = [
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中' },
  { code: 'es', label: 'ES' },
]

export function Layout() {
  const t       = useT()
  const lang    = useLangStore((s) => s.lang)
  const setLang = useLangStore((s) => s.setLang)

  const NAV_ITEMS = [
    { path: '/phones',   label: t('nav_phones')   },
    { path: '/accounts', label: t('nav_accounts') },
    { path: '/generate', label: t('nav_generate') },
    { path: '/queue',    label: t('nav_queue')    },
    { path: '/videos',   label: t('nav_videos')   },
    { path: '/clients',  label: t('nav_clients')  },
  ]

  return (
    <div className={styles.root}>
      <nav className={styles.sidebar}>
        <Link to="/" className={styles.logo}>{t('logo')}</Link>

        <div className={styles.nav}>
          {NAV_ITEMS.map(({ path, label }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `${styles.link} ${isActive ? styles.linkActive : ''}`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        <div className={styles.spacer} />

        {/* Language switcher */}
        <div className={styles.langSwitcher}>
          {LANGS.map(({ code, label }) => (
            <button
              key={code}
              className={`${styles.langBtn} ${lang === code ? styles.langBtnActive : ''}`}
              onClick={() => setLang(code)}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}
