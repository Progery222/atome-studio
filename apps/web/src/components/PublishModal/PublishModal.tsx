import { useEffect, useMemo, useRef, useState } from "react";
import type { Account, Phone, VideoFile } from "@atome/shared";
import { apiFetch } from "../../lib/api";
import { useFarmStore } from "../../stores/farm";
import styles from "./PublishModal.module.css";

interface Props {
  onClose: () => void;
}

type Step = "configure" | "uploading" | "submitting" | "done" | "error";
type PublishPlatform = "tiktok" | "instagram" | "youtube" | "x" | "facebook" | "rumble" | "threads";
type ContentMode = "same" | "random" | "per_phone";
type VideoGroup = "all" | "sportzavod" | "contentzavod" | "streamcut" | "agentmusic";

interface PlatformOption {
  key: PublishPlatform;
  label: string;
}

const PLATFORMS: PlatformOption[] = [
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram Reels" },
  { key: "youtube", label: "YouTube Shorts" },
  { key: "x", label: "X" },
  { key: "facebook", label: "Facebook" },
  { key: "rumble", label: "Rumble" },
  { key: "threads", label: "Threads" },
];

const VIDEO_GROUPS: Array<[VideoGroup, string]> = [
  ["all", "Все видео"],
  ["sportzavod", "SportZavod"],
  ["contentzavod", "content-zavod"],
  ["streamcut", "StreamCut"],
  ["agentmusic", "agentMUSIC"],
];

const DEFAULT_VIDEO_BUCKET = "atome-videos";
const ACCOUNT_PREP_STATUSES = new Set(["needs_creation", "needs_login", "creation_failed", "unknown"]);

function stripBucket(filename: string): string {
  const prefix = `${DEFAULT_VIDEO_BUCKET}/`;
  return filename.startsWith(prefix) ? filename.slice(prefix.length) : filename;
}

function shortVideoTitle(video?: VideoFile | null) {
  if (!video) return "video missing";
  return video.title || stripBucket(video.filename).split("/").pop() || video.filename;
}

function bestVideoCaption(video?: VideoFile | null) {
  if (!video) return "";
  const candidates = [video.caption, video.description, video.title]
    .map((value) => (value || "").trim())
    .filter(Boolean);
  if (candidates.length === 0) return "";
  return candidates.reduce((longest, current) => (longest.length >= current.length ? longest : current));
}

function fallbackHashtags(video?: VideoFile | null) {
  if (!video) return [];
  if (video.hashtags?.length) return video.hashtags.map((tag) => tag.replace(/^#/, "")).filter(Boolean);
  const keyParts = stripBucket(video.filename)
    .split("/")
    .join(" ")
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.toLowerCase())
    .filter((part) => part.length > 2);
  return [...new Set([video.source_service, ...keyParts.slice(0, 4), "highlights"])];
}

function splitTags(value: string) {
  return value
    .split(/[\s,]+/)
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean);
}

function stableIndex(seed: string, modulo: number) {
  if (modulo <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % modulo;
}

function phoneDisplayName(phone: Phone) {
  return phone.display_name || phone.display_id || phone.serial || phone.phone_id;
}

function phoneSubline(phone: Phone) {
  const technical = phone.serial || phone.phone_id;
  if (phone.model && phone.serial_suffix) return `${phone.model} · ${phone.serial_suffix}`;
  return phone.model || technical;
}

function accountGroupName(account?: Account | null) {
  return account?.account_group || account?.niche || "";
}

function sameStringList(a: string[], b: string[]) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function platformLabel(platform: PublishPlatform) {
  return PLATFORMS.find((option) => option.key === platform)?.label || platform;
}

function canUseAccountForSubmit(account?: Account | null) {
  if (!account) return true;
  return account.status === "active" || ACCOUNT_PREP_STATUSES.has(account.status || "");
}

function accountReadinessLabel(account: Account | null, platform: PublishPlatform, accountGroup: string) {
  if (!account) return `создать ${platform}${accountGroup !== "all" ? ` · ${accountGroup}` : ""}`;
  if (account.status === "active") return `ready · @${account.username || "device"}`;
  if (ACCOUNT_PREP_STATUSES.has(account.status || "")) return `account gate · ${account.status}`;
  return `blocked · ${account.status || "unknown"}`;
}

export function PublishModal({ onClose }: Props) {
  const phones = useFarmStore((s) => s.phones);
  const accounts = useFarmStore((s) => s.accounts);
  const videos = useFarmStore((s) => s.videos);
  const videosLoading = useFarmStore((s) => s.videosLoading);
  const fetchPhones = useFarmStore((s) => s.fetchPhones);
  const fetchAccounts = useFarmStore((s) => s.fetchAccounts);
  const fetchVideos = useFarmStore((s) => s.fetchVideos);

  const [step, setStep] = useState<Step>("configure");
  const [progress, setProgress] = useState(0);
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<string[]>([]);
  const [phoneGroup, setPhoneGroup] = useState("manual");
  const [videoGroup, setVideoGroup] = useState<VideoGroup>("all");
  const [contentMode, setContentMode] = useState<ContentMode>("same");
  const [selectedVideoKey, setSelectedVideoKey] = useState("");
  const [videoByPhone, setVideoByPhone] = useState<Record<string, string>>({});
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<PublishPlatform[]>(["tiktok"]);
  const [accountGroup, setAccountGroup] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idemKeyRef = useRef<string>(
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    fetchPhones();
    fetchAccounts();
    fetchVideos();
  }, [fetchAccounts, fetchPhones, fetchVideos]);

  const filteredVideos = useMemo(
    () => videos.filter((video) => videoGroup === "all" || video.source_service === videoGroup),
    [videoGroup, videos]
  );

  const selectedPhones = useMemo(
    () => phones.filter((phone) => selectedPhoneIds.includes(phone.phone_id)),
    [phones, selectedPhoneIds]
  );

  const phoneGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const phone of phones) {
      if (phone.group) groups.add(phone.group);
    }
    return [...groups].sort();
  }, [phones]);

  const accountGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const account of accounts) {
      const group = accountGroupName(account);
      if (group && canUseAccountForSubmit(account)) groups.add(group);
    }
    return [...groups].sort();
  }, [accounts]);

  useEffect(() => {
    if (accountGroup === "all") return;
    const ids = phones
      .filter((phone) =>
        accounts.some(
          (account) =>
            account.phone_id === phone.phone_id &&
            canUseAccountForSubmit(account) &&
            selectedPlatforms.includes(account.platform as PublishPlatform) &&
            accountGroupName(account) === accountGroup
        )
      )
      .map((phone) => phone.phone_id);
    setSelectedPhoneIds((current) => (sameStringList(current, ids) ? current : ids));
  }, [accountGroup, accounts, phones, selectedPlatforms]);

  useEffect(() => {
    if (selectedVideoKey && !filteredVideos.some((video) => video.filename === selectedVideoKey)) {
      setSelectedVideoKey("");
      setCaption("");
      setHashtags("");
    }
    setVideoByPhone((current) => {
      const allowed = new Set(filteredVideos.map((video) => video.filename));
      const next: Record<string, string> = {};
      for (const [phoneId, videoKey] of Object.entries(current)) {
        if (allowed.has(videoKey)) next[phoneId] = videoKey;
      }
      return next;
    });
  }, [filteredVideos, selectedVideoKey]);

  function videoForPhone(phoneId: string) {
    if (contentMode === "same") {
      return videos.find((video) => video.filename === selectedVideoKey) ?? null;
    }
    if (contentMode === "per_phone") {
      return videos.find((video) => video.filename === videoByPhone[phoneId]) ?? null;
    }
    if (filteredVideos.length === 0) return null;
    return filteredVideos[stableIndex(`${phoneId}:${selectedPlatforms.join(",")}:${videoGroup}`, filteredVideos.length)];
  }

  function accountForPhone(phoneId: string, platform: PublishPlatform) {
    const compatible = accounts.filter(
      (account) =>
        account.phone_id === phoneId &&
        account.platform === platform &&
        (accountGroup === "all" || accountGroupName(account) === accountGroup)
    );
    return (
      compatible.find((account) => account.status === "active") ??
      compatible.find((account) => ACCOUNT_PREP_STATUSES.has(account.status || "")) ??
      compatible[0]
    );
  }

  const assignments = useMemo(
    () =>
      selectedPhones.flatMap((phone) =>
        selectedPlatforms.map((platform) => {
          const account = accountForPhone(phone.phone_id, platform) ?? null;
          const video = videoForPhone(phone.phone_id);
          const blockedReason = !video
            ? "Не выбран ролик"
            : !canUseAccountForSubmit(account)
              ? `Account ${account?.status || "unknown"} не готов к gated publish`
              : null;
          return { phone, platform, account, video, blockedReason };
        })
      ),
    [accounts, accountGroup, contentMode, filteredVideos, selectedPlatforms, selectedPhones, selectedVideoKey, videoByPhone, videoGroup, videos]
  );

  const readyAssignments = assignments.filter((item) => item.video && !item.blockedReason);
  const blockedAssignments = assignments.filter((item) => item.blockedReason);
  const submitGroups = new Map<string, typeof readyAssignments>();
  for (const item of readyAssignments) {
    const key = `${item.video?.filename ?? ""}::${item.platform}`;
    if (!submitGroups.has(key)) submitGroups.set(key, []);
    submitGroups.get(key)?.push(item);
  }

  const selectedVideoKeys = new Set(
    assignments.map((item) => item.video?.filename).filter((value): value is string => Boolean(value))
  );
  const metadataOverrideEnabled = contentMode === "same" && selectedVideoKeys.size <= 1;
  const submitDisabledReason =
    selectedPhoneIds.length === 0
      ? "Выбери один или несколько телефонов"
      : selectedPlatforms.length === 0
        ? "Выбери хотя бы одну платформу"
        : readyAssignments.length === 0
          ? "Нет jobs для отправки: проверь выбранные телефоны, платформы и видео"
          : null;

  function selectPhones(ids: string[]) {
    setSelectedPhoneIds([...new Set(ids)]);
  }

  function togglePlatform(platform: PublishPlatform) {
    setSelectedPlatforms((current) => {
      if (current.includes(platform)) return current.filter((item) => item !== platform);
      return [...current, platform];
    });
  }

  function applyAccountGroup(value: string) {
    setAccountGroup(value);
    if (value === "all") return;
    setPhoneGroup("manual");
    const ids = phones
      .filter((phone) =>
        accounts.some(
          (account) =>
            account.phone_id === phone.phone_id &&
            canUseAccountForSubmit(account) &&
            selectedPlatforms.includes(account.platform as PublishPlatform) &&
            accountGroupName(account) === value
        )
      )
      .map((phone) => phone.phone_id);
    selectPhones(ids);
  }

  function applyPhoneGroup(value: string) {
    setPhoneGroup(value);
    if (value === "manual") return;
    if (value === "online") {
      selectPhones(phones.filter((phone) => phone.status === "active").map((phone) => phone.phone_id));
      return;
    }
    if (value.startsWith("group:")) {
      const group = value.slice("group:".length);
      selectPhones(phones.filter((phone) => phone.group === group).map((phone) => phone.phone_id));
      return;
    }
  }

  function togglePhone(phoneId: string) {
    setPhoneGroup("manual");
    setSelectedPhoneIds((current) =>
      current.includes(phoneId)
        ? current.filter((id) => id !== phoneId)
        : [...current, phoneId]
    );
  }

  function pickMainVideo(videoKey: string) {
    setSelectedVideoKey(videoKey);
    const video = videos.find((item) => item.filename === videoKey);
    setCaption(bestVideoCaption(video));
    setHashtags(fallbackHashtags(video).map((tag) => `#${tag}`).join(" "));
  }

  function setPhoneVideo(phoneId: string, videoKey: string) {
    setVideoByPhone((current) => ({ ...current, [phoneId]: videoKey }));
  }

  function resetForm() {
    idemKeyRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setError(null);
    setProgress(0);
    setStep("configure");
  }

  async function handleFile(file: File) {
    setError(null);
    setStep("uploading");
    setProgress(0);

    try {
      const presignRes = await apiFetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type || "video/mp4",
          size: file.size,
        }),
      });
      const { url, key } = (await presignRes.json()) as { url: string; key: string };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Upload HTTP ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.send(file);
      });

      const finalizeRes = await apiFetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const finalized = (await finalizeRes.json()) as { file_url: string };
      setSelectedVideoKey(finalized.file_url);
      setVideoGroup("all");
      setContentMode("same");
      setStep("configure");

      try {
        await apiFetch("/api/upload/thumbnail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, at_seconds: 1 }),
        });
      } catch {
        // thumbnail is optional
      }
    } catch (e) {
      setError((e as Error).message);
      setStep("error");
    }
  }

  async function submit() {
    if (selectedPhoneIds.length === 0) {
      setError("Выбери один или несколько телефонов");
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError("Выбери хотя бы одну платформу");
      return;
    }
    if (readyAssignments.length === 0) {
      setError("Нет целей для отправки: нужно выбрать видео, а banned/disabled аккаунты надо убрать из batch");
      return;
    }
    setStep("submitting");
    setError(null);
    const batchId = `batch_ui_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const overrideTags = splitTags(hashtags);

    try {
      let groupIndex = 0;
      for (const [groupKey, items] of submitGroups.entries()) {
        const [videoKey, platform] = groupKey.split("::") as [string, PublishPlatform];
        const video = items[0]?.video;
        const captionText = metadataOverrideEnabled
          ? caption.trim() || bestVideoCaption(video) || shortVideoTitle(video)
          : undefined;
        const tagList = metadataOverrideEnabled
          ? overrideTags.length
            ? overrideTags
            : fallbackHashtags(video)
          : undefined;
        groupIndex += 1;
        await apiFetch("/api/farm/jobs/publish", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `${idemKeyRef.current}-${platform}-${stableIndex(videoKey, 10_000)}-${groupIndex}`,
          },
          body: JSON.stringify({
            content_key: videoKey,
            content_group: video?.source_service,
            platforms: [platform],
            targets: items.map((item) => ({
              phone_id: item.phone.phone_id,
              account_id: item.account?.account_id,
              account_group: accountGroup !== "all" ? accountGroup : undefined,
            })),
            title: captionText ? captionText.slice(0, 90) : undefined,
            caption: captionText,
            description: captionText,
            hashtags: tagList,
            scheduled_at: scheduledAt || null,
            batch_id: batchId,
          }),
        });
      }
      setStep("done");
      setTimeout(onClose, 900);
    } catch (e) {
      setError((e as Error).message);
      setStep("error");
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop */}
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-label="Публикация группы">
        <header className={styles.head}>
          <div>
            <h2 className={styles.title}>Публикация группы</h2>
            <p className={styles.subtitle}>
              Телефоны, видео-группа и конкретные назначения перед созданием manual jobs
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>
            ✕
          </button>
        </header>

        {step === "uploading" && (
          <div className={styles.drop}>
            <div>Загрузка… {progress}%</div>
            <div className={styles.bar}>
              <div className={styles.barFill} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {(step === "configure" || step === "submitting" || step === "done") && (
          <div className={styles.form}>
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <span>1. Куда публикуем</span>
                <span className={styles.countBadge}>{selectedPhoneIds.length} selected</span>
              </div>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <span>Платформы</span>
                  <div className={styles.platformGrid}>
                    {PLATFORMS.map((platform) => {
                      const selected = selectedPlatforms.includes(platform.key);
                      return (
                        <label
                          key={platform.key}
                          className={selected ? styles.platformActive : styles.platformPill}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => togglePlatform(platform.key)}
                          />
                          <span className={styles.platformText}>{platform.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <label className={styles.field}>
                  <span>Группа телефонов</span>
                  <select
                    value={phoneGroup}
                    onChange={(e) => applyPhoneGroup(e.target.value)}
                    className={styles.input}
                  >
                    <option value="online">Все online телефоны</option>
                    <option value="manual">Ручной выбор</option>
                    {phoneGroups.map((group) => (
                      <option key={group} value={`group:${group}`}>
                        Группа: {group}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Группа аккаунтов</span>
                  <select
                    value={accountGroup}
                    onChange={(e) => applyAccountGroup(e.target.value)}
                    className={styles.input}
                  >
                    <option value="all">Все группы аккаунтов</option>
                    {accountGroups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.phoneList}>
                {phones.map((phone) => {
                  const readyAccounts = selectedPlatforms
                    .map((item) => accountForPhone(phone.phone_id, item))
                    .filter((item): item is Account => Boolean(item));
                  const selected = selectedPhoneIds.includes(phone.phone_id);
                  return (
                    <label key={phone.phone_id} className={styles.phoneRow}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => togglePhone(phone.phone_id)}
                      />
                      <span className={styles.phoneName}>{phoneDisplayName(phone)}</span>
                      <span className={styles.muted}>{phoneSubline(phone)}</span>
                      <span className={phone.status === "active" ? styles.okBadge : styles.warnBadge}>
                        {phone.status}
                      </span>
                      <span className={readyAccounts.length > 0 ? styles.okBadge : styles.warnBadge}>
                        {readyAccounts.length > 0
                          ? readyAccounts
                              .map((account) => `${account.platform}: ${account.status === "active" ? `@${account.username || "device"}` : account.status}`)
                              .join(" · ")
                          : "создать/gate"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <span>2. Что публикуем</span>
                <span className={styles.countBadge}>{filteredVideos.length} videos</span>
              </div>
              <div className={styles.grid2}>
                <label className={styles.field}>
                  <span>Группа видео</span>
                  <select
                    value={videoGroup}
                    onChange={(e) => setVideoGroup(e.target.value as VideoGroup)}
                    className={styles.input}
                  >
                    {VIDEO_GROUPS.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={styles.field}>
                  <span>Распределение</span>
                  <div className={styles.pillRow}>
                    <button
                      type="button"
                      className={contentMode === "same" ? styles.pillActive : styles.pill}
                      onClick={() => setContentMode("same")}
                    >
                      Один всем
                    </button>
                    <button
                      type="button"
                      className={contentMode === "random" ? styles.pillActive : styles.pill}
                      onClick={() => setContentMode("random")}
                    >
                      VHA-random
                    </button>
                    <button
                      type="button"
                      className={contentMode === "per_phone" ? styles.pillActive : styles.pill}
                      onClick={() => setContentMode("per_phone")}
                    >
                      По телефону
                    </button>
                  </div>
                </div>
              </div>

              {contentMode === "random" && (
                <div className={styles.infoLine}>
                  Сейчас UI назначает конкретный ролик из выбранной группы каждому manual job. VHA/alex-local
                  получит уже назначенный `content_key`; следующий gate перенесёт scoring внутрь VHA.
                </div>
              )}

              {contentMode === "same" && (
                <div className={styles.library}>
                  {videosLoading && <div className={styles.hint}>Загрузка…</div>}
                  {!videosLoading && filteredVideos.length === 0 && (
                    <div className={styles.hint}>В выбранной группе пока нет видео.</div>
                  )}
                  {filteredVideos.map((video) => (
                    <button
                      type="button"
                      key={video.filename}
                      className={
                        selectedVideoKey === video.filename
                          ? `${styles.libItem} ${styles.libItemActive}`
                          : styles.libItem
                      }
                      onClick={() => pickMainVideo(video.filename)}
                    >
                      {video.thumbnail_url ? (
                        <img src={video.thumbnail_url} alt="" className={styles.libThumb} />
                      ) : (
                        <div className={styles.libThumbEmpty}>▶</div>
                      )}
                      <div className={styles.libMeta}>
                        <div className={styles.libTitle}>{shortVideoTitle(video)}</div>
                        <div className={styles.libSub}>
                          {video.source_service} · {(video.size_bytes / 1024 / 1024).toFixed(1)} MB
                          {video.created_at ? ` · ${new Date(video.created_at).toLocaleDateString()}` : ""}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {contentMode === "per_phone" && (
                <div className={styles.perPhoneList}>
                  {selectedPhones.length === 0 && (
                    <div className={styles.hint}>Сначала выбери телефоны.</div>
                  )}
                  {selectedPhones.map((phone) => (
                    <label key={phone.phone_id} className={styles.perPhoneRow}>
                      <span>
                        {phoneDisplayName(phone)}
                        <small>{phoneSubline(phone)}</small>
                      </span>
                      <select
                        value={videoByPhone[phone.phone_id] || ""}
                        onChange={(e) => setPhoneVideo(phone.phone_id, e.target.value)}
                        className={styles.input}
                      >
                        <option value="">— выбрать ролик —</option>
                        {filteredVideos.map((video) => (
                          <option key={video.filename} value={video.filename}>
                            {shortVideoTitle(video)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}

              <div
                className={styles.dropCompact}
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
              >
                Загрузить новое видео вручную
                <input
                  ref={inputRef}
                  type="file"
                  accept="video/*"
                  className={styles.hiddenInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </div>
            </section>

            {metadataOverrideEnabled ? (
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <span>3. Метаданные</span>
                  <span className={styles.muted}>только для одного видео</span>
                </div>
                <label className={styles.field}>
                  <span>Caption / описание</span>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={3}
                    maxLength={2200}
                    className={styles.input}
                    placeholder="Оставь пустым, чтобы взять описание из sidecar выбранного видео"
                  />
                </label>

                <label className={styles.field}>
                  <span>Хештеги</span>
                  <input
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    className={styles.input}
                    placeholder="#nfl #highlights"
                  />
                </label>
              </section>
            ) : (
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <span>3. Метаданные</span>
                  <span className={styles.muted}>из MinIO sidecar</span>
                </div>
                <div className={styles.infoLine}>
                  Для нескольких разных видео ручной override скрыт: каждый publish job возьмёт caption,
                  description и hashtags из своего `.json` sidecar в MinIO.
                </div>
              </section>
            )}

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <span>4. Планирование</span>
                <span className={styles.muted}>optional</span>
              </div>
              <label className={styles.field}>
                <span>Время</span>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className={styles.input}
                />
              </label>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <span>Preview jobs</span>
                <span className={readyAssignments.length > 0 ? styles.okBadge : styles.warnBadge}>
                  {readyAssignments.length} ready / {blockedAssignments.length} blocked
                </span>
              </div>
              <div className={styles.previewStats}>
                <span>{selectedPhones.length} phones</span>
                <span>{readyAssignments.length} jobs ready</span>
                <span>{submitGroups.size} submit groups</span>
                <span>{selectedPlatforms.map(platformLabel).join(", ") || "no platform"}</span>
                {accountGroup !== "all" && <span>accounts: {accountGroup}</span>}
              </div>
              <div className={styles.previewList}>
                {assignments.length === 0 && (
                  <div className={styles.hint}>Выбери телефоны и видео, чтобы увидеть child jobs.</div>
                )}
                {assignments.map((item) => (
                  <div key={`${item.phone.phone_id}:${item.platform}`} className={styles.previewRow}>
                    <div>
                      <strong>{phoneDisplayName(item.phone)}</strong>
                      <small>
                        {platformLabel(item.platform)} · {accountReadinessLabel(item.account, item.platform, accountGroup)}
                      </small>
                    </div>
                    <div className={styles.previewVideo}>
                      {item.video ? shortVideoTitle(item.video) : "video missing"}
                    </div>
                    <span className={item.blockedReason ? styles.warnBadge : styles.okBadge}>
                      {item.blockedReason || (item.account?.status === "active" ? "ready" : "account gate")}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <div className={styles.footerActions}>
              {error && <div className={styles.inlineError}>{error}</div>}
              {!error && submitDisabledReason && <div className={styles.footerHint}>{submitDisabledReason}</div>}
              <button type="button" className={styles.secondary} onClick={onClose}>
                Отмена
              </button>
              <button
                type="button"
                className={styles.submit}
                disabled={step !== "configure" || Boolean(submitDisabledReason)}
                onClick={submit}
              >
                {(() => {
                  if (step === "submitting") return "Отправка…";
                  if (step === "done") return "✓ Jobs созданы";
                  return scheduledAt ? "Запланировать batch" : "Создать publish jobs";
                })()}
              </button>
            </div>
          </div>
        )}

        {step === "error" && (
          <div className={styles.error}>
            <div>{error}</div>
            <button type="button" className={styles.submit} onClick={resetForm}>
              Попробовать снова
            </button>
          </div>
        )}
      </div>
    </>
  );
}
