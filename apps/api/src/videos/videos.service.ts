import type { VideoFile } from "@atome/shared";
import { Injectable, Logger } from "@nestjs/common";
import { StreamCutService } from "../streamcut/streamcut.service";

type VideoServiceName = VideoFile["source_service"];

/**
 * VideosService
 *
 * Lists objects from MinIO using the S3-compatible XML list API.
 * For each video (.mp4) it fetches the companion JSON metadata:
 *   - SportZavod:    {same_path}.json  → { caption, title, description, hashtags }
 *   - content-zavod: {same_dir}/prompt.json → { script: { title, description, tags } }
 *   - StreamCut:     done jobs → shorts → VideoFile
 */
@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);
  private readonly minioUrl = process.env.MINIO_URL ?? "http://localhost:9000";
  private readonly minioPublicUrl =
    process.env.MINIO_PUBLIC_URL ?? process.env.MINIO_URL ?? "http://localhost:9000";
  private readonly bucket = process.env.MINIO_BUCKET ?? "atome-videos";

  constructor(private readonly streamcut: StreamCutService) {}

  async getVideos(): Promise<VideoFile[]> {
    const [minioVideos, scVideos] = await Promise.all([
      this.getMinioVideos(),
      this.getStreamCutVideos(),
    ]);
    // Deduplicate: MinIO is source of truth for done StreamCut jobs;
    // scVideos fills in jobs not yet in MinIO (e.g. just completed)
    const minioFilenames = new Set(minioVideos.map((v) => v.filename));
    const uniqueScVideos = scVideos.filter((v) => !minioFilenames.has(v.filename));
    return [...minioVideos, ...uniqueScVideos];
  }

  private async getMinioVideos(): Promise<VideoFile[]> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `${this.minioUrl}/${this.bucket}/?list-type=2`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

        if (!res.ok) {
          this.logger.warn(`MinIO returned ${res.status} for bucket ${this.bucket}`);
          return [];
        }

        const xml = await res.text();
        const { videos, jsonKeys } = this.parseXml(xml);
        await this.enrichWithMeta(videos, jsonKeys);
        return videos.filter((v) => v.filename.endsWith(".mp4"));
      } catch {
        if (attempt === 0) {
          this.logger.warn("MinIO attempt 1 failed, retrying in 2s...");
          await new Promise((r) => setTimeout(r, 2000));
        } else {
          this.logger.warn(`MinIO unavailable at ${this.minioUrl}`);
        }
      }
    }
    return [];
  }

  private async getStreamCutVideos(): Promise<VideoFile[]> {
    try {
      const jobs = await this.streamcut.listJobs();
      const videos: VideoFile[] = [];
      for (const job of jobs) {
        if (job.status !== "done" || !job.shorts?.length) continue;
        for (const s of job.shorts) {
          const filename = this.keyFromPublicStorageUrl(s.url) ?? s.filename;
          const proxyUrl = s.url?.startsWith("/storage/")
            ? `/api/streamcut/storage/${s.url.slice("/storage/".length)}`
            : s.url;
          videos.push({
            filename,
            account_id: "streamcut",
            tenant_id: "streamcut",
            source_service: "streamcut",
            url: proxyUrl ?? "",
            thumbnail_url: "",
            size_bytes: (s as any).file_size ?? 0,
            created_at: (job as any).created_at ?? new Date().toISOString(),
            status: "published",
            title: s.title,
            description: (s as any).description,
          });
        }
      }
      return videos;
    } catch {
      this.logger.warn("StreamCut unavailable for video listing");
      return [];
    }
  }

  private keyFromPublicStorageUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    const marker = `/${this.bucket}/`;
    const index = url.indexOf(marker);
    if (index < 0) return undefined;
    try {
      return decodeURIComponent(url.slice(index + marker.length));
    } catch {
      return url.slice(index + marker.length);
    }
  }

  private parseXml(xml: string): { videos: VideoFile[]; jsonKeys: Set<string> } {
    const videos: VideoFile[] = [];
    const jsonKeys = new Set<string>();
    const contentRegex = /<Contents>([\s\S]*?)<\/Contents>/g;

    for (const match of xml.matchAll(contentRegex)) {
      const block = match[1];
      const key = this.extractTag(block, "Key") ?? "";
      const lastMod = this.extractTag(block, "LastModified") ?? new Date().toISOString();
      const sizeStr = this.extractTag(block, "Size") ?? "0";

      if (!key) continue;
      if (this.isInternalStorageKey(key)) continue;

      if (key.endsWith(".json")) {
        jsonKeys.add(key);
        continue;
      }

      const service = this.inferServiceFromKey(key);

      videos.push({
        filename: key,
        account_id: this.inferAccountId(key, service),
        tenant_id: service,
        source_service: service,
        url: `/api/videos/proxy/${this.encodeKey(key)}`,
        thumbnail_url: "",
        size_bytes: parseInt(sizeStr, 10) || 0,
        created_at: lastMod,
        status: "queued",
      });
    }

    return { videos, jsonKeys };
  }

  private isInternalStorageKey(key: string): boolean {
    const clean = key.toLowerCase();
    return (
      clean.startsWith("cache/") ||
      clean.startsWith("downloads/") ||
      clean.startsWith("processed/") ||
      clean.startsWith("tmp/") ||
      clean.startsWith("_smoke/")
    );
  }

  /**
   * For each video, compute the expected JSON key and fetch it if present.
   * Fetches are batched (max 20 concurrent).
   */
  private async enrichWithMeta(videos: VideoFile[], jsonKeys: Set<string>): Promise<void> {
    const CONCURRENCY = 20;
    const tasks: Array<() => Promise<void>> = [];

    for (const video of videos) {
      const jsonKey = this.resolveJsonKeys(video).find((candidate) => jsonKeys.has(candidate));
      if (!jsonKey || !jsonKeys.has(jsonKey)) continue;

      tasks.push(async () => {
        try {
          const jsonUrl = `${this.minioUrl}/${this.bucket}/${this.encodeKey(jsonKey)}`;
          const res = await fetch(jsonUrl, { signal: AbortSignal.timeout(3000) });
          if (!res.ok) return;
          const data = (await res.json()) as Record<string, unknown>;
          this.applyMeta(video, data);
        } catch {
          // skip silently — metadata is optional
        }
      });
    }

    // Run in batches of CONCURRENCY
    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
      await Promise.allSettled(tasks.slice(i, i + CONCURRENCY).map((t) => t()));
    }
  }

  /**
   * Compute companion JSON keys for a video:
   * - SportZavod / new generators: replace .mp4 → .json
   * - legacy content-zavod: same dir prefix + /prompt.json
   */
  private resolveJsonKeys(video: VideoFile): string[] {
    const key = video.filename;
    const directSidecar = key.replace(/\.mp4$/i, ".json");
    if (
      video.source_service === "sportzavod" ||
      video.source_service === "agentmusic" ||
      video.source_service === "streamcut"
    ) {
      return [directSidecar];
    }
    // content-zavod supports both new `{video}.json` and legacy `prompt.json`.
    const dir = key.substring(0, key.lastIndexOf("/"));
    return dir ? [directSidecar, `${dir}/prompt.json`] : [directSidecar];
  }

  /** Map raw JSON from MinIO into VideoFile metadata fields */
  private applyMeta(video: VideoFile, data: Record<string, unknown>): void {
    const pathService = this.inferServiceFromKey(video.filename);
    const metaService =
      this.normalizeService(data.source_service) ??
      this.normalizeService(data.source) ??
      this.normalizeService(data.service) ??
      this.normalizeService(data.generator);
    const sourceService = pathService === "contentzavod" ? (metaService ?? pathService) : pathService;
    video.source_service = sourceService;
    video.tenant_id = sourceService;
    video.account_id = this.inferAccountId(video.filename, sourceService);

    // Если JSON-метаданные найдены — видео обработано
    const rawStatus = this.str(data.status);
    video.status =
      rawStatus === "queued" || rawStatus === "published" || rawStatus === "rejected"
        ? rawStatus
        : "published";

    if (video.source_service === "sportzavod") {
      this.applyFlatMeta(video, data);
    } else if (video.source_service === "agentmusic" || video.source_service === "streamcut") {
      // flat JSON with title, description, hashtags
      this.applyFlatMeta(video, data);
    } else {
      // content-zavod supports both flat `{video}.json` and legacy prompt.json.
      const script = (data.script ?? {}) as Record<string, unknown>;
      video.title = this.str(data.title) ?? this.str(script.title);
      video.description = this.str(data.description) ?? this.str(script.description);
      video.hashtags =
        this.strArr(data.hashtags) ?? this.strArr(data.tags) ?? this.strArr(script.tags);
      video.caption = this.str(data.caption) ?? this.buildCaption(video);
    }
  }

  private applyFlatMeta(video: VideoFile, data: Record<string, unknown>): void {
    video.title = this.str(data.title);
    video.description = this.str(data.description);
    video.caption = this.str(data.caption);
    video.hashtags = this.strArr(data.hashtags) ?? this.strArr(data.tags);
    if (!video.caption) video.caption = this.buildCaption(video);
  }

  private buildCaption(video: VideoFile): string | undefined {
    const parts: string[] = [];
    if (video.title) parts.push(video.title);
    if (video.description) parts.push(video.description);
    if (video.hashtags?.length) {
      parts.push(video.hashtags.map((t) => `#${t.replace(/^#/, "")}`).join(" "));
    }
    return parts.length ? parts.join("\n\n") : undefined;
  }

  private str(v: unknown): string | undefined {
    return typeof v === "string" && v ? v : undefined;
  }

  private strArr(v: unknown): string[] | undefined {
    return Array.isArray(v) && v.length > 0 ? (v as string[]) : undefined;
  }

  private inferServiceFromKey(key: string): VideoServiceName {
    const clean = key.toLowerCase();
    if (clean.startsWith("sportzavod/") || clean.includes("/sportzavod/")) return "sportzavod";
    if (clean.startsWith("streamcut/") || clean.includes("/streamcut/")) return "streamcut";
    if (clean.startsWith("agentmusic/") || clean.includes("/agentmusic/")) return "agentmusic";
    return "contentzavod";
  }

  private normalizeService(value: unknown): VideoServiceName | undefined {
    if (typeof value !== "string") return undefined;
    const clean = value.trim().toLowerCase().replace(/[-_\s]/g, "");
    if (!clean) return undefined;
    if (clean.includes("sportzavod")) return "sportzavod";
    if (clean.includes("streamcut")) return "streamcut";
    if (clean.includes("agentmusic")) return "agentmusic";
    if (clean.includes("contentzavod") || clean.includes("contentzav")) return "contentzavod";
    return undefined;
  }

  private encodeKey(key: string): string {
    return key.split("/").map(encodeURIComponent).join("/");
  }

  private extractTag(block: string, tag: string): string | null {
    const re = new RegExp(`<${tag}>([^<]*)<\\/${tag}>`);
    const match = re.exec(block);
    return match ? match[1] : null;
  }

  private inferAccountId(key: string, service = this.inferServiceFromKey(key)): string {
    const parts = key.split("/");
    if (service === "sportzavod") return parts[2] ?? parts[1] ?? "";
    if (service === "streamcut") return "streamcut";
    if (service === "agentmusic") return "agentmusic";
    return parts.length >= 2 ? parts[1] : "";
  }

  getVideoUrl(key: string): string {
    return `${this.minioUrl}/${this.bucket}/${key}`;
  }
}
