import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AtomicCanvas, AtomicCanvasHandle } from '../../components/AtomicCanvas/AtomicCanvas'
import { SidePanel }    from '../../components/SidePanel/SidePanel'
import { Tooltip }      from '../../components/Tooltip/Tooltip'
import { PlanetPanel }  from '../../components/PlanetPanel/PlanetPanel'
import { GALAXY_SERVICES } from '../../components/AtomicCanvas/engine'
import { useServicesStore } from '../../stores/services'
import { useFarmStore }     from '../../stores/farm'
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
  const connectWs     = useFarmStore((s) => s.connectWs)
  const disconnectWs  = useFarmStore((s) => s.disconnectWs)

  const selectedId   = useServicesStore((s) => s.selectedId)
  const setSelected  = useServicesStore((s) => s.setSelected)

  const canvasRef = useRef<AtomicCanvasHandle>(null)
  const [demoActive, setDemoActive] = useState(false)

  const focusedPlanet = selectedId
    ? GALAXY_SERVICES.find((s) => s.id === selectedId) ?? null
    : null

  useEffect(() => {
    fetchServices()
    fetchStats()
    connectWs()
    const id = setInterval(() => {
      fetchServices()
      fetchStats()
    }, POLL_INTERVAL)
    return () => {
      clearInterval(id)
      disconnectWs()
    }
  }, [fetchServices, fetchStats, connectWs, disconnectWs])

  const handleDemo = () => {
    if (!canvasRef.current) return
    if (demoActive) {
      canvasRef.current.stopDemo()
      setDemoActive(false)
    } else {
      canvasRef.current.startDemo()
      setDemoActive(true)
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.canvas}>
        <div className={styles.leftNav}>
          <Link to="/" className={styles.logo}>Atome Studio</Link>
          {NAV_ITEMS.map(({ path, label }) => (
            <Link key={path} to={path} className={styles.navLink}>{label}</Link>
          ))}
        </div>

        <AtomicCanvas ref={canvasRef} />

        {/* Planet control panel */}
        {focusedPlanet && (
          <PlanetPanel
            service={focusedPlanet}
            onClose={() => setSelected(null)}
          />
        )}

        {/* Demo / Presentation button */}
        <button
          className={`${styles.demoBtn} ${demoActive ? styles.demoBtnActive : ''}`}
          onClick={handleDemo}
          title={demoActive ? 'Остановить презентацию' : 'Запустить презентацию'}
        >
          {demoActive ? (
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <rect x="6" y="5" width="4" height="14" rx="1"/>
              <rect x="14" y="5" width="4" height="14" rx="1"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M8 5.14v14l11-7-11-7z"/>
            </svg>
          )}
          <span>{demoActive ? 'Стоп' : 'Demo'}</span>
        </button>
      </div>
      <SidePanel />
      {tooltip && <Tooltip data={tooltip} />}
    </div>
  )
}
