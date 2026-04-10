import type { VideoFile } from "@atome/shared";
import { useEffect, useMemo, useState } from "react";
import { LOCALE_MAP, useT } from "../../i18n";
import { useFarmStore } from "../../stores/farm";
import { useLangStore } from "../../stores/lang";
import styles from "./VideosPage.module.css";

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function dateKey(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

// ─── Video Modal ──────────────────────────────────────────────────────────────

function VideoModal({ video, onClose }: { video: VideoFile; onClose: () => void }) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const locale = LOCALE_MAP[lang];

  const statusColor =
    video.status === "published" ? "#22c55e" : video.status === "rejected" ? "#ef4444" : "#60a5fa";

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose}>
          ✕
        </button>

        <div className={styles.modalVideo}>
          <video
            src={video.url}
            controls
            autoPlay
            className={styles.videoPlayer}
            poster={video.thumbnail_url}
          />
        </div>

        <div className={styles.modalInfo}>
          {video.title ? (
            <div className={styles.modalFilename}>{video.title}</div>
          ) : (
            <div className={styles.modalFilename}>{video.filename}</div>
          )}

          {(video.caption || video.description) && (
            <div className={styles.modalDescription}>{video.caption || video.description}</div>
          )}

          {video.source_service !== "sportzavod" && video.hashtags && video.hashtags.length > 0 && (
            <div className={styles.cardHashtags} style={{ marginBottom: 12 }}>
              {video.hashtags.map((tag) => (
                <span key={tag} className={styles.cardHashtag}>
                  #{tag.replace(/^#/, "")}
                </span>
              ))}
            </div>
          )}

          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>{t("videos_modal_account")}</span>
            <span className={styles.modalValue}>{video.account_id}</span>
          </div>
          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>{t("videos_modal_date")}</span>
            <span className={styles.modalValue}>
              {formatDate(video.created_at, locale)} · {formatTime(video.created_at, locale)}
            </span>
          </div>
          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>{t("videos_modal_service")}</span>
            <span className={styles.modalValue}>{video.source_service}</span>
          </div>
          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>{t("videos_modal_status")}</span>
            <span className={styles.modalValue} style={{ color: statusColor }}>
              {video.status}
            </span>
          </div>

          <a href={video.url} download={video.filename} className={styles.modalDownload}>
            {t("videos_download")}
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Video Card ───────────────────────────────────────────────────────────────

function VideoCard({ video, onSelect }: { video: VideoFile; onSelect: () => void }) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);

  const statusColor =
    video.status === "published"
      ? "rgba(34,197,94,0.6)"
      : video.status === "rejected"
        ? "rgba(239,68,68,0.6)"
        : "rgba(96,165,250,0.6)";

  const svcColor =
    video.source_service === "sportzavod"
      ? "rgba(34,197,94,0.55)"
      : video.source_service === "streamcut"
        ? "rgba(0,210,255,0.55)"
        : "rgba(56,189,248,0.55)";
  const svcBorder =
    video.source_service === "sportzavod"
      ? "rgba(34,197,94,0.15)"
      : video.source_service === "streamcut"
        ? "rgba(0,210,255,0.15)"
        : "rgba(56,189,248,0.15)";

  return (
    <div className={styles.card} onClick={onSelect} style={{ cursor: "pointer" }}>
      {/* Preview */}
      <div className={styles.preview}>
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt={video.filename} className={styles.thumb} />
        ) : (
          <video src={video.url} className={styles.thumb} preload="metadata" muted playsInline />
        )}
        <div className={styles.playOverlay}>▶</div>
        <span
          className={styles.statusBadge}
          style={{ color: statusColor, borderColor: statusColor.replace("0.6", "0.2") }}
        >
          {video.status}
        </span>
      </div>

      {/* Info — Telegram-style */}
      <div className={styles.cardBody}>
        {/* Title */}
        {video.title && <div className={styles.cardTitle}>{video.title}</div>}

        {/* Description — full caption (matches Telegram) */}
        {(video.caption || video.description) && (
          <div className={styles.cardDescription}>{video.caption || video.description}</div>
        )}

        {/* Hashtags */}
        {video.hashtags && video.hashtags.length > 0 && (
          <div className={styles.cardHashtags}>
            {video.hashtags.map((tag) => (
              <span key={tag} className={styles.cardHashtag}>
                #{tag.replace(/^#/, "")}
              </span>
            ))}
          </div>
        )}

        {/* Footer: account · time · service */}
        <div className={styles.cardMeta}>
          <span className={styles.cardUsername}>{video.account_id}</span>
          <span className={styles.cardTime}>{formatTime(video.created_at, LOCALE_MAP[lang])}</span>
          <span className={styles.sourceBadge} style={{ color: svcColor, borderColor: svcBorder }}>
            {video.source_service}
          </span>
        </div>

        {/* Actions */}
        <div className={styles.cardActions}>
          <a
            href={video.url}
            download={video.filename}
            className={styles.actionBtn}
            onClick={(e) => e.stopPropagation()}
          >
            {t("videos_card_download")}
          </a>
          <button
            className={styles.actionBtn}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            {t("videos_card_preview")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SortBy = "date_new" | "date_old" | "account";
type FilterService = "all" | "sportzavod" | "contentzavod" | "streamcut";
type FilterStatus = "all" | "queued" | "published" | "rejected";

export function VideosPage() {
  const videos = useFarmStore((s) => s.videos);
  const videosLoading = useFarmStore((s) => s.videosLoading);
  const fetchVideos = useFarmStore((s) => s.fetchVideos);
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null);

  const [sortBy, setSortBy] = useState<SortBy>("date_new");
  const [filterService, setFilterService] = useState<FilterService>("all");
  const [filterAccount, setFilterAccount] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [search, setSearch] = useState<string>("");
  const [groupByDate, setGroupByDate] = useState<boolean>(true);

  useEffect(() => {
    fetchVideos();
  }, []);

  // Unique account list for filter dropdown
  const accountOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of videos) if (v.account_id) set.add(v.account_id);
    return [...set].sort();
  }, [videos]);

  // Filter → search → sort pipeline
  const processed = useMemo(() => {
    let result = videos;

    if (filterService !== "all") {
      result = result.filter((v) => v.source_service === filterService);
    }
    if (filterAccount) {
      result = result.filter((v) => v.account_id === filterAccount);
    }
    if (filterStatus !== "all") {
      result = result.filter((v) => v.status === filterStatus);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((v) => {
        const haystack = [v.title, v.caption, v.description, v.hashtags?.join(" "), v.account_id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    if (sortBy === "date_new") {
      result = [...result].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (sortBy === "date_old") {
      result = [...result].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } else {
      // account: alpha by account_id, then newest first within
      result = [...result].sort((a, b) => {
        const cmp = a.account_id.localeCompare(b.account_id);
        if (cmp !== 0) return cmp;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return result;
  }, [videos, filterService, filterAccount, filterStatus, search, sortBy]);

  // Group by date (only when groupByDate is on)
  const grouped = useMemo(() => {
    if (!groupByDate) return null;
    const map = new Map<string, VideoFile[]>();
    for (const v of processed) {
      const k = dateKey(v.created_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)?.push(v);
    }
    return [...map.entries()];
  }, [processed, groupByDate]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>{t("videos_title")}</div>
          <div className={styles.subtitle}>
            {videosLoading
              ? t("videos_loading")
              : videos.length > 0
                ? `${processed.length} / ${videos.length} ${t("videos_unit")}`
                : t("videos_empty_sub")}
          </div>
        </div>

        <div className={styles.headerControls}>
          {/* Sort */}
          <select
            className={styles.filterSelect}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="date_new">{t("videos_sort_date_new")}</option>
            <option value="date_old">{t("videos_sort_date_old")}</option>
            <option value="account">{t("videos_sort_account")}</option>
          </select>

          {/* Service filter */}
          <select
            className={styles.filterSelect}
            value={filterService}
            onChange={(e) => setFilterService(e.target.value as FilterService)}
          >
            <option value="all">
              {t("videos_filter_service")}: {t("videos_filter_all")}
            </option>
            <option value="sportzavod">sportzavod</option>
            <option value="contentzavod">contentzavod</option>
            <option value="streamcut">streamcut</option>
          </select>

          {/* Account filter */}
          <select
            className={styles.filterSelect}
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
          >
            <option value="">
              {t("videos_filter_account")}: {t("videos_filter_all")}
            </option>
            {accountOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            className={styles.filterSelect}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          >
            <option value="all">
              {t("videos_filter_status")}: {t("videos_filter_all")}
            </option>
            <option value="queued">queued</option>
            <option value="published">published</option>
            <option value="rejected">rejected</option>
          </select>

          {/* Search */}
          <input
            className={styles.searchInput}
            type="text"
            placeholder={t("videos_search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Group by date toggle */}
          <button
            className={`${styles.groupToggle} ${groupByDate ? styles.groupToggleActive : ""}`}
            onClick={() => setGroupByDate((v) => !v)}
          >
            {t("videos_group_by_date")}
          </button>

          {/* Refresh */}
          <button className={styles.syncBtn} onClick={fetchVideos}>
            {t("videos_refresh")}
          </button>
        </div>
      </header>

      {processed.length === 0 && !videosLoading ? (
        <div className={styles.empty}>
          {videos.length === 0 ? t("videos_empty_full") : t("videos_empty_sub")}
        </div>
      ) : grouped ? (
        grouped.map(([key, group]) => (
          <div key={key} className={styles.group}>
            <div className={styles.groupDate}>
              {formatDate(group[0].created_at, LOCALE_MAP[lang])}
            </div>
            <div className={styles.grid}>
              {group.map((v) => (
                <VideoCard key={v.filename} video={v} onSelect={() => setSelectedVideo(v)} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className={styles.grid}>
          {processed.map((v) => (
            <VideoCard key={v.filename} video={v} onSelect={() => setSelectedVideo(v)} />
          ))}
        </div>
      )}

      {selectedVideo && <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />}
    </div>
  );
}
