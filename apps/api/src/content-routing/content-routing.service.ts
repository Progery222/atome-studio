import type { Account, Phone, SportZavodTheme } from "@atome/shared";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { createHash, createHmac } from "node:crypto";
import { FarmService } from "../farm/farm.service";
import { PrismaService } from "../prisma/prisma.service";

type TargetType = "phone" | "account";

interface ListedObject {
  key: string;
  sizeBytes: bigint | null;
  lastModified: Date | null;
}

interface VideoMeta {
  title?: string;
  caption?: string;
  description?: string;
  hashtags?: string[];
  tags?: string[];
  service_key?: string;
  service?: string;
  source_service?: string;
  source?: string;
  account_theme?: string;
  accountTheme?: string;
  topic_key?: string;
  topicKey?: string;
  theme_key?: string;
  theme?: string;
  pool_key?: string;
  artist?: string;
  artist_name?: string;
  artistName?: string;
  influencer?: string;
  influencer_name?: string;
  influencerName?: string;
  creator?: string;
  creator_name?: string;
  creatorName?: string;
  speaker?: string;
  speaker_name?: string;
  speakerName?: string;
  person?: string;
  scenario?: string;
  track_name?: string;
  trackName?: string;
  topic?: string;
  category?: string;
  script?: {
    title?: string;
    description?: string;
    tags?: string[];
    category?: string;
  };
}

const SPORTZAVOD_THEME_KEYS = [
  "NFL",
  "NBA",
  "SOCCER",
  "MMA",
  "F1",
  "MOTORSPORT",
  "SPORTS_BIZ",
  "LIFESTYLE",
  "NCAA",
  "MLB",
  "NHL",
  "SPORTS_TECH",
  "BOXING",
  "ESPORTS",
  "EXTREME",
  "AI",
];

const SPORTZAVOD_ALIASES: Array<[RegExp, string]> = [
  [/\bNFL\b|AMERICAN[_\s-]*FOOTBALL/, "NFL"],
  [/\bNBA\b|BASKETBALL/, "NBA"],
  [/\bSOCCER\b|\bFOOTBALL\b|TRANSFER/, "SOCCER"],
  [/\bMMA\b|\bUFC\b|FIGHT[_\s-]*ANALYSIS|SCANDAL/, "MMA"],
  [/\bF1\b|FORMULA[_\s-]*(1|ONE)/, "F1"],
  [/MOTORSPORT|DRIFT/, "MOTORSPORT"],
  [/SPORTS[_\s-]*(BIZ|BUSINESS)|ATHLETE[_\s-]*WEALTH|INDUSTRY/, "SPORTS_BIZ"],
  [/LIFESTYLE|LUXURY|ATHLETE[_\s-]*SCANDAL/, "LIFESTYLE"],
  [/\bNCAA\b|COLLEGE/, "NCAA"],
  [/\bMLB\b|BASEBALL/, "MLB"],
  [/\bNHL\b|HOCKEY/, "NHL"],
  [/SPORTS[_\s-]*TECH|TECH[_\s-]*INNOVATION/, "SPORTS_TECH"],
  [/BOXING|BOXER/, "BOXING"],
  [/ESPORTS|GAMING/, "ESPORTS"],
  [/EXTREME|ACTION/, "EXTREME"],
  [/\bAI\b|ARTIFICIAL[_\s-]*INTELLIGENCE/, "AI"],
];

const STREAMCUT_THEME_KEYS = [
  "STREAMING",
  "GAMING",
  "PODCASTS",
  "EDUCATION",
  "AI",
  "BUSINESS",
  "LIFESTYLE",
  "CLIPS",
];

const STREAMCUT_DEFAULT_INFLUENCERS = ["Phil"];

const STREAMCUT_ALIASES: Array<[RegExp, string]> = [
  [/TWITCH|STREAM(ER|ING)?|DISCOVERABILITY|VIEWER|CHANNEL|NICHE|PLATFORM|GROWTH/, "STREAMING"],
  [/GAMEPLAY|GAMING|GAME\b|CHALLENGE/, "GAMING"],
  [/PODCAST|INTERVIEW|CONVERSATION/, "PODCASTS"],
  [/\bAI\b|ARTIFICIAL[_\s-]*INTELLIGENCE|INTELLIGENCE/, "AI"],
  [/LESSON|LEARN|TUTORIAL|EXPLAIN|EDUCATION|SMART|RESEARCH|PRESENTATION/, "EDUCATION"],
  [/BUSINESS|REVENUE|MONEY|MONETI[ZS]ATION|SALES/, "BUSINESS"],
  [/LIFESTYLE|DAILY|ROUTINE|MOTIVATION/, "LIFESTYLE"],
];

const AGENTMUSIC_TECHNICAL_THEME_KEYS = ["KARAOKE", "LYRICS", "MUSIC", "CHORUS"];

interface AgentMusicItem {
  artist?: string;
  artist_name?: string;
  artistName?: string;
  name?: string;
  title?: string;
  track_name?: string;
  trackName?: string;
  track?: {
    artist?: string;
    artist_name?: string;
    artistName?: string;
  };
}

@Injectable()
export class ContentRoutingService {
  private readonly logger = new Logger(ContentRoutingService.name);
  private readonly minioUrl = process.env.MINIO_URL ?? "http://localhost:9000";
  private readonly minioPublicUrl =
    process.env.MINIO_PUBLIC_URL ?? process.env.MINIO_URL ?? "http://localhost:9000";
  private readonly bucket = process.env.MINIO_BUCKET ?? "atome-videos";
  private readonly accessKey =
    process.env.MINIO_ACCESS_KEY ?? process.env.MINIO_ROOT_USER ?? "minioadmin";
  private readonly secretKey =
    process.env.MINIO_SECRET_KEY ?? process.env.MINIO_ROOT_PASSWORD ?? "minioadmin";
  private readonly region = process.env.MINIO_REGION ?? "us-east-1";
  private readonly agentmusicUrl = process.env.AGENTMUSIC_URL ?? "http://localhost:8080";

  constructor(
    private readonly prisma: PrismaService,
    private readonly farm: FarmService,
  ) {}

  async getThemes() {
    await this.syncCanonicalThemes();
    return this.prisma.contentTheme.findMany({
      where: { status: "active" },
      orderBy: [{ serviceKey: "asc" }, { name: "asc" }],
    });
  }

  async getRules(params: { phoneId?: string; accountId?: string }) {
    const or: Array<{ targetType: string; targetId: string }> = [];
    if (params.phoneId) or.push({ targetType: "phone", targetId: params.phoneId });
    if (params.accountId) or.push({ targetType: "account", targetId: params.accountId });
    return this.prisma.contentRouteRule.findMany({
      where: or.length ? { OR: or } : undefined,
      orderBy: [{ targetType: "asc" }, { targetId: "asc" }],
    });
  }

  async saveRule(body: unknown) {
    const input = body as {
      target_type?: TargetType;
      targetType?: TargetType;
      target_id?: string;
      targetId?: string;
      theme_ids?: string[];
      themeIds?: string[];
      queue_depth?: number;
      queueDepth?: number;
    };
    const targetType = input.target_type ?? input.targetType;
    const targetId = (input.target_id ?? input.targetId ?? "").trim();
    const themeIds = input.theme_ids ?? input.themeIds ?? [];
    const queueDepthRaw = input.queue_depth ?? input.queueDepth ?? 1;
    const queueDepth = Math.max(1, Math.min(10, Number(queueDepthRaw) || 1));

    if (targetType !== "phone" && targetType !== "account") {
      throw new BadRequestException("target_type must be phone or account");
    }
    if (!targetId) throw new BadRequestException("target_id required");
    if (!Array.isArray(themeIds)) throw new BadRequestException("theme_ids must be an array");

    const existingThemes = await this.prisma.contentTheme.findMany({
      where: { id: { in: themeIds } },
      select: { id: true },
    });
    const validThemeIds = existingThemes.map((t) => t.id);

    return this.prisma.contentRouteRule.upsert({
      where: { targetType_targetId: { targetType, targetId } },
      create: {
        targetType,
        targetId,
        themeIds: validThemeIds,
        queueDepth,
        status: "active",
      },
      update: {
        themeIds: validThemeIds,
        queueDepth,
        status: "active",
      },
    });
  }

  async getVideos(params: { serviceKey?: string; themeKey?: string; status?: string }) {
    const videos = await this.prisma.contentVideo.findMany({
      where: {
        ...(params.serviceKey ? { serviceKey: params.serviceKey } : {}),
        ...(params.themeKey ? { themeKey: params.themeKey } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 300,
    });

    return videos.map((video) => ({
      ...video,
      sizeBytes: video.sizeBytes?.toString() ?? null,
    }));
  }

  async recordDelivery(body: unknown) {
    const input = body as {
      account_id?: string;
      accountId?: string;
      phone_id?: string;
      phoneId?: string;
      video_id?: string;
      videoId?: string;
      status?: string;
      published_url?: string;
      publishedUrl?: string;
      meta?: unknown;
    };
    const accountId = (input.account_id ?? input.accountId ?? "").trim();
    const phoneId = (input.phone_id ?? input.phoneId ?? "").trim();
    const videoId = (input.video_id ?? input.videoId ?? "").trim();
    const status = (input.status ?? "published").trim();
    const publishedUrl = input.published_url ?? input.publishedUrl;
    if (!accountId || !videoId) throw new BadRequestException("account_id and video_id required");

    return this.prisma.contentDelivery.upsert({
      where: { accountId_videoId: { accountId, videoId } },
      create: {
        accountId,
        phoneId: phoneId || null,
        videoId,
        status,
        publishedUrl,
        metaJson: this.asJson(input.meta),
      },
      update: {
        phoneId: phoneId || null,
        status,
        publishedUrl,
        metaJson: this.asJson(input.meta),
      },
    });
  }

  async scanMinio() {
    await this.syncCanonicalThemes();
    const objects = await this.listObjects();
    const jsonKeys = new Set(objects.filter((o) => o.key.endsWith(".json")).map((o) => o.key));
    const videos = objects.filter((o) => /\.mp4$/i.test(o.key) && this.isRoutableVideoKey(o.key));
    let indexed = 0;
    let unclassified = 0;

    for (const object of videos) {
      const metadataKey = this.resolveMetadataKey(object.key, jsonKeys);
      const meta = metadataKey ? await this.fetchJson(metadataKey) : undefined;
      const classification = this.classifyVideo(object.key, meta);
      if (classification.themeKey === "unclassified") unclassified++;

      const theme = await this.prisma.contentTheme.upsert({
        where: {
          serviceKey_themeKey: {
            serviceKey: classification.serviceKey,
            themeKey: classification.themeKey,
          },
        },
        create: {
          serviceKey: classification.serviceKey,
          themeKey: classification.themeKey,
          name: classification.themeName,
          description: classification.description,
          status: classification.themeStatus,
          source: "minio",
          metaJson: this.asJson(meta),
        },
        update: {
          name: classification.themeName,
          description: classification.description,
          metaJson: this.asJson(meta),
          status: classification.themeStatus,
        },
      });

      const hashtags = this.strArr(meta?.hashtags) ?? this.strArr(meta?.tags) ?? this.strArr(meta?.script?.tags) ?? [];
      const title = this.str(meta?.title) ?? this.str(meta?.script?.title) ?? "";
      const description = this.str(meta?.description) ?? this.str(meta?.script?.description) ?? "";
      const caption = this.str(meta?.caption) ?? this.buildCaption(title, description, hashtags);

      await this.prisma.contentVideo.upsert({
        where: { bucket_minioKey: { bucket: this.bucket, minioKey: object.key } },
        create: {
          serviceKey: classification.serviceKey,
          themeKey: theme.themeKey,
          bucket: this.bucket,
          minioKey: object.key,
          metadataKey,
          title,
          caption,
          hashtags,
          status: theme.themeKey === "unclassified" ? "unclassified" : "ready",
          sizeBytes: object.sizeBytes,
          lastModified: object.lastModified,
          metaJson: this.asJson(meta),
        },
        update: {
          serviceKey: classification.serviceKey,
          themeKey: theme.themeKey,
          metadataKey,
          title,
          caption,
          hashtags,
          status: theme.themeKey === "unclassified" ? "unclassified" : "ready",
          sizeBytes: object.sizeBytes,
          lastModified: object.lastModified,
          metaJson: this.asJson(meta),
        },
      });
      indexed++;
    }

    return { ok: true, scanned: objects.length, videos: videos.length, indexed, unclassified };
  }

  async buildManifests() {
    const [phones, accounts, rules, themes] = await Promise.all([
      this.farm.getPhones().catch(() => [] as Phone[]),
      this.farm.getAccounts().catch(() => [] as Account[]),
      this.prisma.contentRouteRule.findMany({ where: { status: "active" } }),
      this.prisma.contentTheme.findMany({ where: { status: "active" } }),
    ]);
    const themeById = new Map(themes.map((t) => [t.id, t]));
    const phoneById = new Map(phones.map((p) => [p.phone_id, p]));
    const rulesByKey = new Map(rules.map((r) => [`${r.targetType}:${r.targetId}`, r]));
    const activeAccounts = accounts.filter((a) => a.status === "active" && a.account_id);
    const knownAccountIds = new Set(activeAccounts.map((a) => a.account_id));
    for (const rule of rules) {
      if (rule.targetType !== "account" || knownAccountIds.has(rule.targetId)) continue;
      activeAccounts.push({
        account_id: rule.targetId,
        phone_id: "",
        username: rule.targetId,
        status: "active",
      } as Account);
      knownAccountIds.add(rule.targetId);
    }
    const accountsByPhone = new Map<string, Account[]>();
    const accountManifests: unknown[] = [];

    for (const account of activeAccounts) {
      const phone = phoneById.get(account.phone_id);
      if (phone && phone.status !== "active") continue;
      const accountRule = rulesByKey.get(`account:${account.account_id}`);
      const phoneRule = rulesByKey.get(`phone:${account.phone_id}`);
      const rule = accountRule ?? phoneRule;
      if (!rule) continue;

      const themeIds = this.jsonStringArray(rule.themeIds).filter((id) => themeById.has(id));
      const selectedThemes = themeIds.map((id) => themeById.get(id)!);
      const videos = await this.selectVideosForAccount(account.account_id, selectedThemes, rule.queueDepth);
      const manifest = {
        version: 1,
        generated_at: new Date().toISOString(),
        target_type: "account",
        account_id: account.account_id,
        phone_id: account.phone_id,
        username: account.username,
        rule_source: accountRule ? "account" : "phone",
        queue_depth: rule.queueDepth,
        allowed_themes: selectedThemes.map((t) => this.themeDto(t)),
        videos,
      };
      await this.putJson(`routing/accounts/${this.safeKey(account.account_id)}/manifest.json`, manifest);
      accountManifests.push(manifest);
      if (account.phone_id) {
        accountsByPhone.set(account.phone_id, [...(accountsByPhone.get(account.phone_id) ?? []), account]);
      }
    }

    let phoneManifestCount = 0;
    for (const [phoneId, phoneAccounts] of accountsByPhone.entries()) {
      const accountItems = accountManifests.filter(
        (m) => (m as { phone_id?: string }).phone_id === phoneId,
      );
      const manifest = {
        version: 1,
        generated_at: new Date().toISOString(),
        target_type: "phone",
        phone_id: phoneId,
        accounts: phoneAccounts.map((a) => ({
          account_id: a.account_id,
          username: a.username,
          manifest_key: `routing/accounts/${this.safeKey(a.account_id)}/manifest.json`,
          manifest: accountItems.find((m) => (m as { account_id?: string }).account_id === a.account_id),
        })),
      };
      await this.putJson(`routing/phones/${this.safeKey(phoneId)}/manifest.json`, manifest);
      phoneManifestCount++;
    }

    return {
      ok: true,
      account_manifests: accountManifests.length,
      phone_manifests: phoneManifestCount,
    };
  }

  private async selectVideosForAccount(accountId: string, themes: Array<{ serviceKey: string; themeKey: string }>, depth: number) {
    if (!themes.length) return [];
    const videos = await this.prisma.contentVideo.findMany({
      where: {
        status: "ready",
        OR: themes.map((t) => ({ serviceKey: t.serviceKey, themeKey: t.themeKey })),
        deliveries: { none: { accountId, status: "published" } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: Math.max(1, Math.min(10, depth)),
    });
    return videos.map((v) => ({
      video_id: v.id,
      service_key: v.serviceKey,
      theme_key: v.themeKey,
      minio_bucket: v.bucket,
      minio_key: v.minioKey,
      download_url: `${this.minioPublicUrl.replace(/\/+$/, "")}/${v.bucket}/${this.encodeKey(v.minioKey)}`,
      caption: v.caption,
      hashtags: this.jsonStringArray(v.hashtags),
      metadata: v.metaJson ?? {},
    }));
  }

  private async listObjects(): Promise<ListedObject[]> {
    const out: ListedObject[] = [];
    let continuationToken = "";
    for (let page = 0; page < 20; page++) {
      const query: Record<string, string> = { "list-type": "2" };
      if (continuationToken) query["continuation-token"] = continuationToken;
      const xml = await this.minioRequestText("GET", "", query);
      for (const block of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const item = block[1];
        const key = this.xmlText(item, "Key");
        if (!key) continue;
        const size = this.xmlText(item, "Size");
        const lastModified = this.xmlText(item, "LastModified");
        out.push({
          key,
          sizeBytes: size ? BigInt(size) : null,
          lastModified: lastModified ? new Date(lastModified) : null,
        });
      }
      const truncated = this.xmlText(xml, "IsTruncated") === "true";
      continuationToken = this.xmlText(xml, "NextContinuationToken") ?? "";
      if (!truncated || !continuationToken) break;
    }
    return out;
  }

  private isRoutableVideoKey(key: string): boolean {
    const clean = key.toLowerCase();
    return !(
      clean.startsWith("cache/") ||
      clean.startsWith("downloads/") ||
      clean.startsWith("processed/") ||
      clean.startsWith("tmp/") ||
      clean.startsWith("_smoke/")
    );
  }

  private async fetchJson(key: string): Promise<VideoMeta | undefined> {
    try {
      const text = await this.minioRequestText("GET", key, {});
      return JSON.parse(text) as VideoMeta;
    } catch {
      return undefined;
    }
  }

  private async putJson(key: string, payload: unknown): Promise<void> {
    const body = JSON.stringify(this.toJsonSafe(payload), null, 2);
    await this.minioRequestText("PUT", key, {}, body, "application/json; charset=utf-8");
  }

  private async minioRequestText(
    method: "GET" | "PUT",
    key: string,
    query: Record<string, string>,
    body = "",
    contentType = "application/octet-stream",
  ): Promise<string> {
    const base = new URL(this.minioUrl.replace(/\/+$/, ""));
    const path = key ? `/${this.bucket}/${this.encodeKey(key)}` : `/${this.bucket}/`;
    const url = new URL(`${base.origin}${path}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const headers = this.signS3Request(method, base.host, path, query, body, contentType);
    const res = await fetch(url, {
      method,
      headers,
      body: method === "PUT" ? body : undefined,
      signal: AbortSignal.timeout(method === "PUT" ? 15000 : 8000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`MinIO ${method} ${path} -> ${res.status}: ${text.slice(0, 120)}`);
    return text;
  }

  private signS3Request(
    method: string,
    host: string,
    path: string,
    query: Record<string, string>,
    body: string,
    contentType: string,
  ): Record<string, string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = createHash("sha256").update(body).digest("hex");
    const canonicalQuery = Object.entries(query)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    const canonicalHeaders =
      `content-type:${contentType}\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
      method,
      path,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");
    const signingKey = this.hmac(
      this.hmac(this.hmac(this.hmac(`AWS4${this.secretKey}`, dateStamp), this.region), "s3"),
      "aws4_request",
    );
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    return {
      "Content-Type": contentType,
      Host: host,
      "X-Amz-Content-Sha256": payloadHash,
      "X-Amz-Date": amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }

  private hmac(key: string | Buffer, value: string): Buffer {
    return createHmac("sha256", key).update(value).digest();
  }

  private resolveMetadataKey(videoKey: string, jsonKeys: Set<string>): string | undefined {
    const direct = videoKey.replace(/\.mp4$/i, ".json");
    if (jsonKeys.has(direct)) return direct;
    const dir = videoKey.includes("/") ? videoKey.slice(0, videoKey.lastIndexOf("/")) : "";
    const prompt = dir ? `${dir}/prompt.json` : "prompt.json";
    if (jsonKeys.has(prompt)) return prompt;
    return undefined;
  }

  private classifyVideo(key: string, meta?: VideoMeta) {
    const serviceKey = this.normalizeService(meta?.service_key ?? meta?.source_service ?? meta?.service ?? meta?.source) ?? this.inferService(key);
    if (serviceKey === "sportzavod") {
      const sportTheme = this.sportzavodThemeFromMetaOrPath(meta, key);
      const themeKey = sportTheme ? this.slug(sportTheme) : "unclassified";
      return {
        serviceKey,
        themeKey,
        themeName: sportTheme ?? "Unclassified",
        themeStatus: themeKey === "unclassified" ? "unclassified" : "active",
        description: themeKey === "unclassified" ? `Unclassified MinIO path: ${key}` : "SportZavod routing category",
      };
    }
    if (serviceKey === "streamcut") {
      const influencer = this.streamCutInfluencerFromMeta(meta) ?? "Phil";
      return {
        serviceKey,
        themeKey: this.slug(influencer),
        themeName: influencer,
        themeStatus: "active",
        description: "StreamCut influencer",
      };
    }
    if (serviceKey === "agentmusic") {
      const artist = this.agentMusicArtistFromMeta(meta);
      const themeKey = artist ? this.slug(artist) : "unclassified";
      return {
        serviceKey,
        themeKey,
        themeName: artist ?? "Unclassified",
        themeStatus: themeKey === "unclassified" ? "unclassified" : "active",
        description: themeKey === "unclassified" ? `Missing agentMUSIC artist metadata: ${key}` : "agentMUSIC artist",
      };
    }

    const explicitTheme =
      meta?.theme_key ??
      meta?.theme ??
      meta?.pool_key ??
      meta?.artist ??
      meta?.influencer ??
      meta?.topic ??
      meta?.category ??
      meta?.script?.category;
    const pathTheme = this.inferThemeFromKey(key, serviceKey);
    const rawTheme = this.normalThemeCandidate(explicitTheme) ?? this.normalThemeCandidate(pathTheme) ?? "unclassified";
    const themeKey = this.slug(rawTheme) || "unclassified";
    const themeName = themeKey === "unclassified" ? "Unclassified" : this.humanName(rawTheme);
    const themeStatus = themeKey === "unclassified" ? "unclassified" : "active";
    return {
      serviceKey,
      themeKey,
      themeName,
      themeStatus,
      description: themeKey === "unclassified" ? `Unclassified MinIO path: ${key}` : "",
    };
  }

  private inferService(key: string): string {
    const clean = key.toLowerCase();
    if (clean.startsWith("sportzavod/") || clean.includes("/sportzavod/")) return "sportzavod";
    if (clean.startsWith("agentmusic/") || clean.includes("/agentmusic/")) return "agentmusic";
    if (clean.startsWith("streamcut/") || clean.includes("/streamcut/")) return "streamcut";
    if (clean.startsWith("content-zavod/") || clean.startsWith("contentzavod/")) return "content-zavod";
    return "content-zavod";
  }

  private normalizeService(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const clean = value.trim().toLowerCase();
    if (!clean) return undefined;
    if (clean.includes("sportzavod")) return "sportzavod";
    if (clean.includes("agentmusic")) return "agentmusic";
    if (clean.includes("streamcut")) return "streamcut";
    if (clean.includes("content")) return "content-zavod";
    return this.slug(clean);
  }

  private inferThemeFromKey(key: string, serviceKey: string): string {
    const parts = key.split("/").filter(Boolean);
    const serviceIndex = parts.findIndex((p) => this.normalizeService(p) === serviceKey);
    const afterService = serviceIndex >= 0 ? parts.slice(serviceIndex + 1) : parts.slice(1);
    if (!afterService.length) return "unclassified";
    const candidates = afterService
      .map((part) => part.replace(/\.(mp4|mov|m4v|json)$/i, ""))
      .map((part) => part.replace(/^\d+[_-]+/, "").replace(/[_-]+\d+$/g, ""))
      .filter(Boolean);
    const normal = candidates.find((part) => this.normalThemeCandidate(part));
    if (normal) return normal;
    if (serviceKey === "agentmusic") return "music";
    return "unclassified";
  }

  private async syncCanonicalThemes(): Promise<void> {
    await this.syncSportzavodThemes();
    await this.syncStaticThemes("streamcut", STREAMCUT_DEFAULT_INFLUENCERS, "StreamCut influencer");
    await this.syncAgentMusicArtists();
  }

  private async syncSportzavodThemes(): Promise<void> {
    let themes: SportZavodTheme[] = [];
    try {
      themes = await this.farm.getSportzavodThemes();
    } catch {
      themes = [];
    }

    const byKey = new Map<string, SportZavodTheme>();
    for (const theme of themes) {
      const key = this.sportzavodCanonicalThemeKey(theme.theme_key) ?? this.sportzavodCanonicalThemeKey(theme.theme_name);
      if (!key) continue;
      byKey.set(key, theme);
    }

    for (const key of SPORTZAVOD_THEME_KEYS) {
      const sourceTheme = byKey.get(key);
      await this.prisma.contentTheme.upsert({
        where: {
          serviceKey_themeKey: {
            serviceKey: "sportzavod",
            themeKey: this.slug(key),
          },
        },
        create: {
          serviceKey: "sportzavod",
          themeKey: this.slug(key),
          name: key,
          description: sourceTheme ? `${sourceTheme.count ?? 0} SportZavod accounts` : "SportZavod routing category",
          status: "active",
          source: "sportzavod",
          metaJson: this.asJson(sourceTheme ?? { theme_key: key, theme_name: key, count: 0 }),
        },
        update: {
          name: key,
          description: sourceTheme ? `${sourceTheme.count ?? 0} SportZavod accounts` : "SportZavod routing category",
          status: "active",
          source: "sportzavod",
          metaJson: this.asJson(sourceTheme ?? { theme_key: key, theme_name: key, count: 0 }),
        },
      });
    }
  }

  private async syncStaticThemes(serviceKey: string, keys: string[], description: string): Promise<void> {
    for (const key of keys) {
      await this.prisma.contentTheme.upsert({
        where: {
          serviceKey_themeKey: {
            serviceKey,
            themeKey: this.slug(key),
          },
        },
        create: {
          serviceKey,
          themeKey: this.slug(key),
          name: key,
          description,
          status: "active",
          source: serviceKey,
          metaJson: { theme_key: key, theme_name: key },
        },
        update: {
          name: key,
          description,
          status: "active",
          source: serviceKey,
          metaJson: { theme_key: key, theme_name: key },
        },
      });
    }
  }

  private async syncAgentMusicArtists(): Promise<void> {
    const artists = new Map<string, AgentMusicItem>();
    const [tracks, choruses] = await Promise.all([
      this.fetchAgentMusicItems("/api/tracks"),
      this.fetchAgentMusicItems("/api/choruses"),
    ]);

    for (const item of [...tracks, ...choruses]) {
      const artist = this.agentMusicArtistFromItem(item);
      if (!artist) continue;
      artists.set(this.slug(artist), item);
    }

    for (const [themeKey, item] of artists.entries()) {
      const artist = this.agentMusicArtistFromItem(item);
      if (!artist) continue;
      await this.prisma.contentTheme.upsert({
        where: {
          serviceKey_themeKey: {
            serviceKey: "agentmusic",
            themeKey,
          },
        },
        create: {
          serviceKey: "agentmusic",
          themeKey,
          name: artist,
          description: "agentMUSIC artist",
          status: "active",
          source: "agentmusic",
          metaJson: this.asJson(item),
        },
        update: {
          name: artist,
          description: "agentMUSIC artist",
          status: "active",
          source: "agentmusic",
          metaJson: this.asJson(item),
        },
      });
    }
  }

  private async fetchAgentMusicItems(path: string): Promise<AgentMusicItem[]> {
    try {
      const res = await fetch(`${this.agentmusicUrl}${path}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data)) return data as AgentMusicItem[];
      if (Array.isArray(data?.items)) return data.items as AgentMusicItem[];
      if (Array.isArray(data?.tracks)) return data.tracks as AgentMusicItem[];
      if (Array.isArray(data?.choruses)) return data.choruses as AgentMusicItem[];
      return [];
    } catch {
      this.logger.warn(`agentMUSIC unavailable: GET ${path}`);
      return [];
    }
  }

  private agentMusicArtistFromMeta(meta: VideoMeta | undefined): string | undefined {
    return this.cleanArtistName(
      meta?.artist ??
        meta?.artist_name ??
        meta?.artistName ??
        this.artistFromTrackName(meta?.track_name ?? meta?.trackName) ??
        meta?.track_name ??
        meta?.trackName,
    );
  }

  private agentMusicArtistFromItem(item: AgentMusicItem): string | undefined {
    return this.cleanArtistName(
      item.artist ??
        item.artist_name ??
        item.artistName ??
        item.track?.artist ??
        item.track?.artist_name ??
        item.track?.artistName ??
        this.artistFromTrackName(item.track_name ?? item.trackName ?? item.title ?? item.name) ??
        item.track_name ??
        item.trackName ??
        item.title ??
        item.name,
    );
  }

  private artistFromTrackName(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const clean = value.trim();
    const separator = clean.match(/\s[-–—]\s/);
    if (!separator?.index) return undefined;
    return clean.slice(0, separator.index).trim();
  }

  private cleanArtistName(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const clean = value.trim();
    if (!clean || this.isTechnicalThemeValue(clean)) return undefined;
    if (AGENTMUSIC_TECHNICAL_THEME_KEYS.includes(clean.toUpperCase())) return undefined;
    return clean;
  }

  private streamCutInfluencerFromMeta(meta: VideoMeta | undefined): string | undefined {
    return this.cleanInfluencerName(
      meta?.influencer ??
        meta?.influencer_name ??
        meta?.influencerName ??
        meta?.creator ??
        meta?.creator_name ??
        meta?.creatorName ??
        meta?.speaker ??
        meta?.speaker_name ??
        meta?.speakerName ??
        meta?.person,
    );
  }

  private cleanInfluencerName(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const clean = value.trim();
    if (!clean || this.isTechnicalThemeValue(clean)) return undefined;
    if (STREAMCUT_THEME_KEYS.includes(clean.toUpperCase())) return undefined;
    return clean;
  }

  private sportzavodThemeFromMetaOrPath(meta: VideoMeta | undefined, key: string): string | undefined {
    const candidates = [
      meta?.account_theme,
      meta?.accountTheme,
      meta?.theme_key,
      meta?.theme,
      meta?.pool_key,
      meta?.topic_key,
      meta?.topicKey,
      meta?.topic,
      meta?.category,
      meta?.script?.category,
      ...this.sportzavodPathCandidates(key),
    ];
    for (const candidate of candidates) {
      const normalized = this.sportzavodCanonicalThemeKey(candidate);
      if (normalized) return normalized;
    }
    return undefined;
  }

  private canonicalThemeFromMetaOrPath(
    meta: VideoMeta | undefined,
    key: string,
    canonicalKeys: string[],
    aliases: Array<[RegExp, string]>,
  ): string | undefined {
    const candidates = [
      meta?.account_theme,
      meta?.accountTheme,
      meta?.theme_key,
      meta?.theme,
      meta?.pool_key,
      meta?.topic_key,
      meta?.topicKey,
      meta?.topic,
      meta?.category,
      meta?.artist,
      meta?.influencer,
      meta?.scenario,
      meta?.track_name,
      meta?.trackName,
      meta?.script?.category,
      meta?.title,
      meta?.caption,
      meta?.description,
      meta?.script?.title,
      meta?.script?.description,
      ...(meta?.hashtags ?? []),
      ...(meta?.tags ?? []),
      ...(meta?.script?.tags ?? []),
      ...this.servicePathCandidates(key),
    ];
    for (const candidate of candidates) {
      const normalized = this.canonicalThemeKey(candidate, canonicalKeys, aliases);
      if (normalized) return normalized;
    }
    return undefined;
  }

  private servicePathCandidates(key: string): string[] {
    return key
      .split("/")
      .filter(Boolean)
      .map((part) => part.replace(/\.(mp4|mov|m4v|json)$/i, ""))
      .flatMap((part) => [
        part,
        part.replace(/^\d+[_-]+/, "").replace(/[_-]+\d+$/g, ""),
      ]);
  }

  private canonicalThemeKey(value: unknown, canonicalKeys: string[], aliases: Array<[RegExp, string]>): string | undefined {
    if (typeof value !== "string") return undefined;
    const upper = value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!upper || this.isTechnicalThemeValue(upper)) return undefined;
    if (canonicalKeys.includes(upper)) return upper;
    const parts = upper.split("_").filter(Boolean);
    const joined = parts.join("_");
    if (canonicalKeys.includes(joined)) return joined;
    for (const part of parts) {
      if (canonicalKeys.includes(part)) return part;
    }
    for (const [pattern, key] of aliases) {
      if (pattern.test(upper)) return key;
    }
    return undefined;
  }

  private sportzavodPathCandidates(key: string): string[] {
    return this.servicePathCandidates(key);
  }

  private sportzavodCanonicalThemeKey(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const upper = value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!upper || this.isTechnicalThemeValue(upper)) return undefined;
    if (SPORTZAVOD_THEME_KEYS.includes(upper)) return upper;

    const parts = upper.split("_").filter(Boolean);
    const joined = parts.join("_");
    if (SPORTZAVOD_THEME_KEYS.includes(joined)) return joined;
    for (const part of parts) {
      if (SPORTZAVOD_THEME_KEYS.includes(part)) return part;
    }

    if (joined.includes("SPORTS_BIZ") || joined.includes("SPORTS_BUSINESS") || parts.includes("BUSINESS")) {
      return "SPORTS_BIZ";
    }
    if (joined.includes("SPORTS_TECH") || joined.includes("TECH_INNOVATION") || parts.includes("TECHNOLOGY")) {
      return "SPORTS_TECH";
    }
    if (parts.includes("UFC")) return "MMA";
    if (parts.includes("FORMULA") || joined.includes("FORMULA_1") || joined.includes("FORMULA_ONE")) return "F1";

    for (const [pattern, key] of SPORTZAVOD_ALIASES) {
      if (pattern.test(upper)) return key;
    }
    return undefined;
  }

  private normalThemeCandidate(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const clean = value.trim();
    if (!clean || this.isTechnicalThemeValue(clean)) return undefined;
    return clean;
  }

  private isTechnicalThemeValue(value: string): boolean {
    const clean = value.trim().toLowerCase();
    const withoutExt = clean.replace(/\.(mp4|mov|m4v|json)$/i, "");
    return (
      clean === "unclassified" ||
      /\.(mp4|mov|m4v|json)$/i.test(clean) ||
      /^\d{4}[-_]\d{2}[-_]\d{2}$/.test(clean) ||
      /^\d+$/.test(clean) ||
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(clean) ||
      /^[a-f0-9]{10,}$/i.test(withoutExt) ||
      /^[a-z0-9]{10,}$/i.test(withoutExt)
    );
  }

  private themeDto(theme: { id: string; serviceKey: string; themeKey: string; name: string }) {
    return {
      id: theme.id,
      service_key: theme.serviceKey,
      theme_key: theme.themeKey,
      name: theme.name,
    };
  }

  private buildCaption(title: string, description: string, hashtags: string[]): string {
    return [title, description, hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")]
      .filter(Boolean)
      .join("\n\n");
  }

  private jsonStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  }

  private str(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private strArr(value: unknown): string[] | undefined {
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      : undefined;
  }

  private asJson(value: unknown): object | undefined {
    return value && typeof value === "object" ? (value as object) : undefined;
  }

  private slug(value: unknown): string {
    if (typeof value !== "string") return "";
    return value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}-]+/gu, "_")
      .replace(/^_+|_+$/g, "");
  }

  private humanName(value: unknown): string {
    if (typeof value !== "string") return "";
    return value.trim().replace(/[_-]+/g, " ");
  }

  private safeKey(value: string): string {
    return encodeURIComponent(value).replace(/%/g, "_");
  }

  private encodeKey(key: string): string {
    return key.split("/").map(encodeURIComponent).join("/");
  }

  private xmlText(block: string, tag: string): string | undefined {
    const match = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(block);
    return match ? this.xmlDecode(match[1]) : undefined;
  }

  private xmlDecode(value: string): string {
    return value
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'");
  }

  private toJsonSafe(value: unknown): unknown {
    if (typeof value === "bigint") return value.toString();
    if (Array.isArray(value)) return value.map((v) => this.toJsonSafe(v));
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, this.toJsonSafe(v)]),
      );
    }
    return value;
  }
}
