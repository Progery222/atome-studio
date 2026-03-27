import { TooltipData } from '../../stores/services'
import styles from './Tooltip.module.css'

interface Props {
  data: TooltipData
}

const STATUS_COLOR: Record<string, string> = {
  online:  '#00d8a8',
  offline: '#ef4444',
  idle:    '#fbbf24',
  error:   '#ef4444',
}

export function Tooltip({ data }: Props) {
  const { x, y, service } = data

  return (
    <div
      className={styles.tooltip}
      style={{ left: x + 14, top: y - 10 }}
    >
      <div
        className={styles.platform}
        style={{ color: `rgb(${service.col.join(',')})` }}
      >
        {service.platform}
      </div>
      <div className={styles.name}>{service.name}</div>
      <div className={styles.row}>
        <span>Type</span>
        <span>{service.type}</span>
      </div>
      <div className={styles.row}>
        <span>Status</span>
        <span style={{ color: STATUS_COLOR[service.status] ?? '#fff' }}>
          {service.status}
        </span>
      </div>
      <div className={styles.row}>
        <span>Modified</span>
        <span>{service.modified}</span>
      </div>
    </div>
  )
}
