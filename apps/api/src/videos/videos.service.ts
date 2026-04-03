import type { VideoFile } from "@atome/shared";
import { Injectable, Logger } from "@nestjs/common";

/**
 * VideosService
 *
 * Lists objects from MinIO using the S3-compatible XML list API.
 * No SDK required — plain fetch to GET /{bucket}/?list-type=2
 *
 * Falls back to [] if MinIO is unavailable.
 */
@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);
  private readonly minioUrl = process.env.MINIO_URL ?? "http://localhost:9000";
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
      return this.parseXml(xml);
    } catch {
      this.logger.warn(`MinIO unavailable at ${this.minioUrl}`);
      return [];
    }
  }

  /**
   * Minimal XML parser — extracts <Key> and <LastModified> from S3 ListObjectsV2 XML.
   * Avoids pulling in xml2js or fast-xml-parser.
   */
  private parseXml(xml: string): VideoFile[] {
    const contents: VideoFile[] = [];
    const contentRegex = /<Contents>([\s\S]*?)<\/Contents>/g;

    for (const match of xml.matchAll(contentRegex)) {
      const block = match[1];
      const key = this.extractTag(block, "Key") ?? "";
      const lastMod = this.extractTag(block, "LastModified") ?? new Date().toISOString();
      const sizeStr = this.extractTag(block, "Size") ?? "0";

      if (!key) continue;

      const service = key.includes("sportzavod") ? "sportzavod" : "contentzavod";

      contents.push({
        filename: key,
        account_id: this.inferAccountId(key),
        tenant_id: this.inferTenantId(key),
        source_service: service,
        url: `${this.minioUrl}/${this.bucket}/${encodeURIComponent(key)}`,
        thumbnail_url: "",
        size_bytes: parseInt(sizeStr, 10) || 0,
        created_at: lastMod,
        status: "queued",
      });
    }

    return contents;
  }

  private extractTag(block: string, tag: string): string | null {
    const re = new RegExp(`<${tag}>([^<]*)<\\/${tag}>`);
    const match = re.exec(block);
    return match ? match[1] : null;
  }

  /** Infer account_id from path like tenant123/account456/video.mp4 */
  private inferAccountId(key: string): string {
    const parts = key.split("/");
    return parts.length >= 2 ? parts[1] : "";
  }

  private inferTenantId(key: string): string {
    const parts = key.split("/");
    return parts.length >= 1 ? parts[0] : "";
  }
}
