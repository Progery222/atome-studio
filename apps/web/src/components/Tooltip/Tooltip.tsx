import { TooltipData } from '../../stores/services'
import styles from './Tooltip.module.css'

interface Props {
  data: TooltipData
}

const STATUS_COLOR: Record<string, string> = {
  online:   '#22c55e',
  degraded: '#eab308',
  offline:  '#ef4444',
  error:    '#ef4444',
}

const STATUS_LABEL: Record<string, string> = {
  online:   'online',
  degraded: 'degraded',
  offline:  'offline',
  error:    'error',
}

export function Tooltip({ data }: Props) {
  const { x, y, service } = data
  const [cr, cg, cb] = service.col

  return (
    <div
      className={styles.tooltip}
      style={{ left: x + 14, top: y - 10 }}
    >
      <div
        className={styles.name}
        style={{ color: `rgb(${cr},${cg},${cb})` }}
      >
        {service.name}
      </div>
      <div className={styles.row}>
        <span>Статус</span>
        <span style={{ color: STATUS_COLOR[service.status] ?? '#fff' }}>
          {STATUS_LABEL[service.status] ?? service.status}
        </span>
      </div>
      {service.uptime !== undefined && (
        <div className={styles.row}>
          <span>Uptime</span>
          <span>{service.uptime.toFixed(1)}%</span>
        </div>
      )}
      {service.activeJobs !== undefined && service.activeJobs > 0 && (
        <div className={styles.row}>
          <span>Jobs</span>
          <span style={{ color: '#fbbf24' }}>{service.activeJobs} active</span>
        </div>
      )}
    </div>
  )
}
