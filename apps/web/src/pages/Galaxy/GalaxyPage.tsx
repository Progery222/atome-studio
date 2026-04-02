import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { AtomicCanvas, AtomicCanvasHandle } from '../../components/AtomicCanvas/AtomicCanvas'
import { SidePanel }    from '../../components/SidePanel/SidePanel'
import { Tooltip }      from '../../components/Tooltip/Tooltip'
import { PlanetPanel }  from '../../components/PlanetPanel/PlanetPanel'
import { GALAXY_SERVICES, GalaxyService } from '../../components/AtomicCanvas/engine'
import { useServicesStore } from '../../stores/services'
import { useFarmStore }     from '../../stores/farm'
import styles from './GalaxyPage.module.css'

const POLL_INTERVAL = 30_000
const EXIT_DURATION = 450

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
  const [settled, setSettled] = useState(false)

  // Visible panel state — allows exit animation before removal
  const [visiblePlanet, setVisiblePlanet] = useState<GalaxyService | null>(null)
  const [panelExiting, setPanelExiting] = useState(false)
  const exitTimer = useRef<ReturnType<typeof setTimeout>>()

  const focusedPlanet = selectedId
    ? GALAXY_SERVICES.find((s) => s.id === selectedId) ?? null
    : null

  // Track camera settled state
  const rafRef = useRef(0)
  const trackSettled = useCallback(() => {
    if (!canvasRef.current || !selectedId) {
      setSettled(false)
      return
    }
    setSettled(canvasRef.current.isCameraSettled())
    rafRef.current = requestAnimationFrame(trackSettled)
  }, [selectedId])

  useEffect(() => {
    if (selectedId) {
      setSettled(false)
      rafRef.current = requestAnimationFrame(trackSettled)
    } else {
      setSettled(false)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [selectedId, trackSettled])

  // Manage enter/exit transitions
  useEffect(() => {
    if (focusedPlanet && settled) {
      clearTimeout(exitTimer.current)
      setPanelExiting(false)
      setVisiblePlanet(focusedPlanet)
    } else if (visiblePlanet && !focusedPlanet) {
      setPanelExiting(true)
      exitTimer.current = setTimeout(() => {
        setVisiblePlanet(null)
        setPanelExiting(false)
      }, EXIT_DURATION)
    } else if (visiblePlanet && focusedPlanet && visiblePlanet.id !== focusedPlanet.id) {
      setPanelExiting(true)
      exitTimer.current = setTimeout(() => {
        setPanelExiting(false)
        setVisiblePlanet(null)
      }, EXIT_DURATION)
    }
    return () => clearTimeout(exitTimer.current)
  }, [focusedPlanet, settled])

  // Show new planet after exit finishes
  useEffect(() => {
    if (!visiblePlanet && !panelExiting && focusedPlanet && settled) {
      setVisiblePlanet(focusedPlanet)
    }
  }, [visiblePlanet, panelExiting, focusedPlanet, settled])

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

  // TODO: При подключении ботов — включить live-статусы планет:
  // canvasRef.current.updateServiceStatus(svc.id, svc.status)

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

  const handlePanelClose = () => {
    setPanelExiting(true)
    exitTimer.current = setTimeout(() => {
      setVisiblePlanet(null)
      setPanelExiting(false)
      setSelected(null)
    }, EXIT_DURATION)
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

        {/* Planet control panel — centered */}
        {visiblePlanet && (
          <PlanetPanel
            key={visiblePlanet.id}
            service={visiblePlanet}
            exiting={panelExiting}
            onClose={handlePanelClose}
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
