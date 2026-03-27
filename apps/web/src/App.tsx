import { AtomicCanvas } from './components/AtomicCanvas/AtomicCanvas'
import { SidePanel } from './components/SidePanel/SidePanel'
import { Tooltip } from './components/Tooltip/Tooltip'
import { useServicesStore } from './stores/services'
import styles from './App.module.css'

export function App() {
  const tooltip = useServicesStore((s) => s.tooltip)

  return (
    <div className={styles.app}>
      <div className={styles.canvasWrap}>
        <AtomicCanvas />
      </div>
      <SidePanel />
      {tooltip && <Tooltip data={tooltip} />}
    </div>
  )
}
