import type { VideoFile } from "@atome/shared";
import { Injectable, Logger } from "@nestjs/common";

/**
 * VideosService
 *
 * Lists objects from MinIO using the S3-compatible XML list API.
 * For each video (.mp4) it fetches the companion JSON metadata:
 *   - SportZavod:    {same_path}.json  → { caption, title, description, hashtags }
 *   - content-zavod: {same_dir}/prompt.json → { script: { title, description, tags } }
 */
@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);
  private readonly minioUrl = process.env.MINIO_URL ?? "http://localhost:9000";
  private readonly minioPublicUrl =
    process.env.MINIO_PUBLIC_URL ?? process.env.MINIO_URL ?? "http://localhost:9000";
  private readonly bucket = process.env.MINIO_BUCKET ?? "atome-videos";

  async getVideos(): Promise<VideoFile[]> {
    try {
      const url = `${this.minioUrl}/${this.bucket}/?list-type=2`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

      if (!res.ok) {
        this.logger.warn(`MinIO returned ${res.status} for bucket ${this.bucket}`);
        return [];
      }

      const xml = await res.text();
      const { videos, jsonKeys } = this.parseXml(xml);

      // Enrich with companion JSON metadata in parallel
      await this.enrichWithMeta(videos, jsonKeys);

      // Only return .mp4 files
      return videos.filter((v) => v.filename.endsWith(".mp4"));
    } catch {
      this.logger.warn(`MinIO unavailable at ${this.minioUrl}`);
      return [];
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

      if (key.endsWith(".json")) {
        jsonKeys.add(key);
        continue;
      }

      const service = key.includes("sportzavod") ? "sportzavod" : "contentzavod";

      videos.push({
        filename: key,
        account_id: this.inferAccountId(key),
        tenant_id: this.inferTenantId(key),
        source_service: service,
        url: `${this.minioPublicUrl}/${this.bucket}/${this.encodeKey(key)}`,
        thumbnail_url: "",
        size_bytes: parseInt(sizeStr, 10) || 0,
        created_at: lastMod,
        status: "queued",
      });
    }

    return { videos, jsonKeys };
  }

  /**
   * For each video, compute the expected JSON key and fetch it if present.
   * Fetches are batched (max 20 concurrent).
   */
  private async enrichWithMeta(videos: VideoFile[], jsonKeys: Set<string>): Promise<void> {
    const CONCURRENCY = 20;
    const tasks: Array<() => Promise<void>> = [];

    for (const video of videos) {
      const jsonKey = this.resolveJsonKey(video);
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
   * Compute companion JSON key for a video:
   * - SportZavod:    replace .mp4 → .json
   * - content-zavod: same dir prefix + /prompt.json
   */
  private resolveJsonKey(video: VideoFile): string | null {
    const key = video.filename;
    if (video.source_service === "sportzavod") {
      return key.replace(/\.mp4$/i, ".json");
    }
    // content-zavod: {account_id}/{date}/{topic_slug}/{title_slug}.mp4
    const dir = key.substring(0, key.lastIndexOf("/"));
    return dir ? `${dir}/prompt.json` : null;
  }

  /** Map raw JSON from MinIO into VideoFile metadata fields */
  private applyMeta(video: VideoFile, data: Record<string, unknown>): void {
    if (video.source_service === "sportzavod") {
      video.title = this.str(data.title);
      video.description = this.str(data.description);
      video.caption = this.str(data.caption);
      video.hashtags = this.strArr(data.hashtags);
    } else {
      // content-zavod prompt.json
      const script = (data.script ?? {}) as Record<string, unknown>;
      video.title = this.str(script.title);
      video.description = this.str(script.description);
      video.hashtags = this.strArr(script.tags);
    }
  }

  private str(v: unknown): string | undefined {
    return typeof v === "string" && v ? v : undefined;
  }

  private strArr(v: unknown): string[] | undefined {
    return Array.isArray(v) && v.length > 0 ? (v as string[]) : undefined;
  }

  private encodeKey(key: string): string {
    return key.split("/").map(encodeURIComponent).join("/");
  }

  private extractTag(block: string, tag: string): string | null {
    const re = new RegExp(`<${tag}>([^<]*)<\\/${tag}>`);
    const match = re.exec(block);
    return match ? match[1] : null;
  }

  private inferAccountId(key: string): string {
    const parts = key.split("/");
    return parts.length >= 2 ? parts[1] : "";
  }

  private inferTenantId(key: string): string {
    const parts = key.split("/");
    return parts.length >= 1 ? parts[0] : "";
  }
}
