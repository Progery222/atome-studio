export interface AppConfig {
  port: number;
  jwtSecret: string;
  apiKey: string;
  adminEmail?: string;
  adminPassword?: string;
  adminName: string;
  minioUrl: string;
  minioPublicUrl: string;
  minioBucket: string;
  minioAccessKey: string;
  minioSecretKey: string;
  minioRegion: string;
  sportzavodUrl: string;
  contentzavodUrl: string;
  agentmusicUrl: string;
  streamcutUrl: string;
  streamcutServicePassword: string;
  farmApiUrl: string;
  autonomyUrl: string;
  orchestratorUrl: string;
  vllmUrl: string;
  vllmModel: string;
  nodeAgentSecret: string;
  adminAllowedIps: string;
}

export interface EnvValidationResult {
  config: AppConfig;
  warnings: string[];
}

function env(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function numberEnv(name: string, fallback: number): number {
  const raw = env(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function warnIfLocal(name: string, value: string, hint: string, warnings: string[]): void {
  if (value.includes("localhost") || value.includes("127.0.0.1")) {
    warnings.push(`${name}=${value}${hint ? ` - ${hint}` : ""}`);
  }
}

export function loadAppConfig(): AppConfig {
  const minioUrl = env("MINIO_URL", "http://localhost:9000");
  const autonomyUrl = env("AUTONOMY_URL", "http://localhost:8001");
  const farmApiUrl = env("ATOME_FARM_URL", autonomyUrl || "http://10.8.0.1:8001");

  return {
    port: numberEnv("PORT", 3001),
    jwtSecret: env("JWT_SECRET"),
    apiKey: env("API_KEY", "dev-api-key"),
    adminEmail: env("ADMIN_EMAIL") || undefined,
    adminPassword: env("ADMIN_PASSWORD") || undefined,
    adminName: env("ADMIN_NAME", "Admin"),
    minioUrl,
    minioPublicUrl: env("MINIO_PUBLIC_URL", minioUrl),
    minioBucket: env("MINIO_BUCKET", "atome-videos"),
    minioAccessKey: env("MINIO_ACCESS_KEY", env("MINIO_ROOT_USER", "minioadmin")),
    minioSecretKey: env("MINIO_SECRET_KEY", env("MINIO_ROOT_PASSWORD", "minioadmin")),
    minioRegion: env("MINIO_REGION", "us-east-1"),
    sportzavodUrl: env("SPORTZAVOD_URL", "http://localhost:8000"),
    contentzavodUrl: env("CONTENTZAVOD_URL", "http://localhost:8002"),
    agentmusicUrl: env("AGENTMUSIC_URL", "http://localhost:8080"),
    streamcutUrl: env("STREAMCUT_URL", "http://localhost:8003"),
    streamcutServicePassword: env("STREAMCUT_SERVICE_PASSWORD", "atome-service-pw"),
    farmApiUrl,
    autonomyUrl,
    orchestratorUrl: env("ORCHESTRATOR_URL", autonomyUrl),
    vllmUrl: env("VLLM_URL", "http://91.84.98.58:8000"),
    vllmModel: env("VLLM_MODEL", "Qwen3-VL-32B-AWQ"),
    nodeAgentSecret: env("NODE_AGENT_SECRET"),
    adminAllowedIps: env("ADMIN_ALLOWED_IPS"),
  };
}

export function validateEnv(): EnvValidationResult {
  const config = loadAppConfig();
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!config.jwtSecret) errors.push("JWT_SECRET is required");

  warnIfLocal("MINIO_URL", config.minioUrl, "Videos page will be empty in production", warnings);
  warnIfLocal(
    "SPORTZAVOD_URL",
    config.sportzavodUrl,
    "SportZavod generation will not work in production",
    warnings
  );
  warnIfLocal(
    "CONTENTZAVOD_URL",
    config.contentzavodUrl,
    "content-zavod generation will not work in production",
    warnings
  );
  warnIfLocal("ATOME_FARM_URL", config.farmApiUrl, "farm data will not be available in production", warnings);

  if (config.minioBucket !== "atome-videos") {
    warnings.push(
      `MINIO_BUCKET=${config.minioBucket} - expected atome-videos unless all generators use the same bucket`
    );
  }

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  return { config, warnings };
}
