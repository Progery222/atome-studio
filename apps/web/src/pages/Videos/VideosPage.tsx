import { useEffect, useMemo } from 'react'
import { VideoFile } from '@atome/shared'
import { useFarmStore } from '../../stores/farm'
import styles from './VideosPage.module.css'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day:   '2-digit',
      month: 'long',
      year:  'numeric',
    })
  } catch {
    return iso
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('ru-RU', {
      hour:   '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function dateKey(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return iso
  }
}

// ─── Video Card ───────────────────────────────────────────────────────────────

function VideoCard({ video }: { video: VideoFile }) {
  const statusColor = video.status === 'published'
    ? 'rgba(34,197,94,0.6)'
    : video.status === 'rejected'
      ? 'rgba(239,68,68,0.6)'
      : 'rgba(96,165,250,0.6)'

  return (
    <div className={styles.card}>
      {/* Preview */}
      <div className={styles.preview}>
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.filename}
            className={styles.thumb}
          />
        ) : (
          <div className={styles.thumbPlaceholder}>
            <span className={styles.thumbIcon}>[vid]</span>
          </div>
        )}
        <span
          className={styles.statusBadge}
          style={{ color: statusColor, borderColor: statusColor.replace('0.6', '0.2') }}
        >
          {video.status}
        </span>
      </div>

      {/* Info */}
      <div className={styles.cardBody}>
        <div className={styles.cardUsername}>{video.account_id}</div>
        <div className={styles.cardMeta}>
          <span className={styles.cardTime}>{formatTime(video.created_at)}</span>
          <span
            className={styles.sourceBadge}
            style={{
              color: video.source_service === 'sportzavod'
                ? 'rgba(34,197,94,0.55)'
                : 'rgba(56,189,248,0.55)',
              borderColor: video.source_service === 'sportzavod'
                ? 'rgba(34,197,94,0.15)'
                : 'rgba(56,189,248,0.15)',
            }}
          >
            {video.source_service}
          </span>
        </div>

        {/* Actions */}
        <div className={styles.cardActions}>
          <a
            href={video.url}
            download={video.filename}
            className={styles.actionBtn}
          >
            Скачать
          </a>
          <a
            href={video.url}
            target="_blank"
            rel="noreferrer"
            className={styles.actionBtn}
          >
            Просмотр
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function VideosPage() {
  const videos        = useFarmStore((s) => s.videos)
  const videosLoading = useFarmStore((s) => s.videosLoading)
  const fetchVideos   = useFarmStore((s) => s.fetchVideos)

  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, VideoFile[]>()
    for (const v of videos) {
      const k = dateKey(v.created_at)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(v)
    }
    // Sort descending
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [videos])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>Видеотека</div>
          <div className={styles.subtitle}>
            {videosLoading
              ? 'загрузка…'
              : videos.length > 0
                ? `${videos.length} видео`
                : 'нет видео'}
          </div>
        </div>
        <button className={styles.syncBtn} onClick={fetchVideos}>
          обновить
        </button>
      </header>

      {videos.length === 0 && !videosLoading ? (
        <div className={styles.empty}>— видео не найдены · MinIO недоступен</div>
      ) : (
        grouped.map(([key, group]) => (
          <div key={key} className={styles.group}>
            <div className={styles.groupDate}>{formatDate(group[0].created_at)}</div>
            <div className={styles.grid}>
              {group.map((v) => (
                <VideoCard key={v.filename} video={v} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
