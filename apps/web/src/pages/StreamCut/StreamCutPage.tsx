import type { StreamCutJob } from "@atome/shared";
import { useEffect, useRef, useState } from "react";
import { useT } from "../../i18n";
import { useStreamCutStore } from "../../stores/streamcut";
import styles from "./StreamCutPage.module.css";

const CAPTION_STYLES = ["default", "karaoke", "glow", "bold", "highlight", "minimal"];
const REFRAME_MODES = ["center", "ai"];
const MUSIC_OPTIONS = ["none", "upbeat", "calm", "motivation"];

function statusClass(status: string) {
  if (status === "done") return styles.statusDone;
  if (status === "error") return styles.statusError;
  if (status === "pending") return styles.statusPending;
  return styles.statusRunning;
}

function stepDotClass(status: string) {
  if (status === "done") return styles.stepDone;
  if (status === "error") return styles.stepError;
  if (status === "active") return styles.stepActive;
  return styles.stepPending;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function isActive(job: StreamCutJob): boolean {
  return job.status !== "done" && job.status !== "error";
}

export function StreamCutPage() {
  const t = useT();
  const {
    jobs,
    jobsLoading,
    videoInfo,
    videoInfoLoading,
    creating,
    fetchJobs,
    createJob,
    deleteJob,
    fetchVideoInfo,
    clearVideoInfo,
  } = useStreamCutStore();

  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("auto");
  const [maxShorts, setMaxShorts] = useState(5);
  const [captionStyle, setCaptionStyle] = useState("default");
  const [reframeMode, setReframeMode] = useState("center");
  const [addMusic, setAddMusic] = useState("none");

  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // Initial fetch + polling
  useEffect(() => {
    fetchJobs();
    pollRef.current = setInterval(() => {
      fetchJobs();
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  const handleFetchInfo = () => {
    if (url.trim()) fetchVideoInfo(url.trim());
  };

  const handleSubmit = async () => {
    if (!url.trim()) return;
    await createJob({
      url: url.trim(),
      language,
      max_shorts: maxShorts,
      caption_style: captionStyle,
      reframe_mode: reframeMode,
      add_music: addMusic,
    });
    setUrl("");
    clearVideoInfo();
  };

  const activeCount = jobs.filter(isActive).length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{t("streamcut_title")}</div>
          <div className={styles.subtitle}>{t("streamcut_subtitle")}</div>
        </div>
      </div>

      {/* Two columns */}
      <div className={styles.columns}>
        {/* Left: Input form */}
        <div className={styles.formCard}>
          {/* URL input */}
          <div className={styles.urlRow}>
            <input
              className={styles.urlInput}
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("streamcut_url_ph")}
              onKeyDown={(e) => e.key === "Enter" && handleFetchInfo()}
            />
            <button
              type="button"
              className={styles.infoBtn}
              onClick={handleFetchInfo}
              disabled={videoInfoLoading || !url.trim()}
            >
              {videoInfoLoading ? "..." : t("streamcut_fetch_info")}
            </button>
          </div>

          {/* Video preview */}
          {videoInfo && (
            <div className={styles.videoPreview}>
              {videoInfo.thumbnail && (
                <img src={videoInfo.thumbnail} alt="" className={styles.thumbnail} />
              )}
              <div className={styles.videoMeta}>
                <div className={styles.videoTitle}>{videoInfo.title || "—"}</div>
                <div className={styles.videoDuration}>
                  {t("streamcut_duration")}: {formatDuration(videoInfo.duration)}
                  {videoInfo.uploader && ` · ${videoInfo.uploader}`}
                </div>
              </div>
            </div>
          )}

          {/* Options */}
          <div className={styles.options}>
            <div className={styles.field}>
              <label>{t("streamcut_language")}</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="auto">Auto</option>
                <option value="ru">Russian</option>
                <option value="en">English</option>
                <option value="zh">Chinese</option>
                <option value="es">Spanish</option>
              </select>
            </div>

            <div className={styles.field}>
              <label>{t("streamcut_max_shorts")}</label>
              <input
                type="number"
                min={1}
                max={15}
                value={maxShorts}
                onChange={(e) => setMaxShorts(Number(e.target.value))}
              />
            </div>

            <div className={styles.field}>
              <label>{t("streamcut_caption_style")}</label>
              <select value={captionStyle} onChange={(e) => setCaptionStyle(e.target.value)}>
                {CAPTION_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label>{t("streamcut_reframe")}</label>
              <select value={reframeMode} onChange={(e) => setReframeMode(e.target.value)}>
                {REFRAME_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label>{t("streamcut_music")}</label>
              <select value={addMusic} onChange={(e) => setAddMusic(e.target.value)}>
                {MUSIC_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit */}
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={creating || !url.trim()}
          >
            {creating ? "..." : t("streamcut_start")}
          </button>
        </div>

        {/* Right: Jobs */}
        <div className={styles.jobsPanel}>
          <div className={styles.jobsPanelTitle}>
            {t("streamcut_jobs")}
            {activeCount > 0 && ` (${activeCount})`}
          </div>

          {jobs.length === 0 && !jobsLoading && (
            <div className={styles.noJobs}>{t("streamcut_no_jobs")}</div>
          )}

          {jobs.map((job) => (
            <JobCard key={job.job_id} job={job} onDelete={deleteJob} t={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Job Card ──────────────────────────────────────────────────────────────────

function JobCard({
  job,
  onDelete,
  t,
}: {
  job: StreamCutJob;
  onDelete: (id: string) => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className={styles.jobCard}>
      <div className={styles.jobHeader}>
        <span className={styles.jobId}>{job.job_id.slice(0, 8)}</span>
        <span className={`${styles.jobStatus} ${statusClass(job.status)}`}>{job.status}</span>
      </div>

      {/* Progress */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${job.progress}%` }} />
      </div>

      {/* Steps */}
      {job.steps && job.steps.length > 0 && (
        <div className={styles.steps}>
          {job.steps.map((step) => (
            <div key={step.id} className={styles.step}>
              <span className={`${styles.stepDot} ${stepDotClass(step.status)}`} />
              <span className={styles.stepLabel}>
                {step.label}
                {step.detail && ` — ${step.detail}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Message */}
      {job.message && !job.error && <div className={styles.jobMessage}>{job.message}</div>}

      {/* Error */}
      {job.error && (
        <div className={styles.jobError}>
          {t("streamcut_error")}: {job.error}
        </div>
      )}

      {/* Shorts */}
      {job.shorts && job.shorts.length > 0 && (
        <div className={styles.shortsList}>
          <div className={styles.shortsTitle}>
            {job.shorts.length} {t("streamcut_shorts_ready")}
          </div>
          {job.shorts.map((s, i) => (
            <div key={s.filename} className={styles.shortItem}>
              <span className={styles.shortName}>
                {s.title || `Short ${i + 1}`}
                {s.duration ? ` (${formatDuration(s.duration)})` : ""}
              </span>
              {s.url && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.shortLink}
                >
                  ▶
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {(job.status === "done" || job.status === "error") && (
        <div className={styles.jobActions}>
          <button type="button" className={styles.deleteBtn} onClick={() => onDelete(job.job_id)}>
            {t("streamcut_delete")}
          </button>
        </div>
      )}
    </div>
  );
}
