import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AtomicCanvas } from '../../components/AtomicCanvas/AtomicCanvas'
import { SidePanel }    from '../../components/SidePanel/SidePanel'
import { Tooltip }      from '../../components/Tooltip/Tooltip'
import { useServicesStore } from '../../stores/services'
import styles from './GalaxyPage.module.css'

const POLL_INTERVAL = 30_000

const NAV_ITEMS = [
  { path: '/phones',   label: 'Phones'   },
  { path: '/accounts', label: 'Accounts' },
  { path: '/generate', label: 'Generate' },
  { path: '/queue',    label: 'Queue'    },
  { path: '/videos',   label: 'Videos'   },
]

export function GalaxyPage() {
  const tooltip       = useServicesStore((s) => s.tooltip)
  const fetchServices = useServicesStore((s) => s.fetchServices)
  const fetchStats    = useServicesStore((s) => s.fetchStats)

  useEffect(() => {
    fetchServices()
    fetchStats()
    const id = setInterval(() => {
      fetchServices()
      fetchStats()
    }, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchServices, fetchStats])

  return (
    <div className={styles.root}>
      <div className={styles.canvas}>
        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ path, label }) => (
            <Link key={path} to={path} className={styles.navLink}>{label}</Link>
          ))}
        </nav>
        <AtomicCanvas />
      </div>
      <SidePanel />
      {tooltip && <Tooltip data={tooltip} />}
    </div>
  )
}
