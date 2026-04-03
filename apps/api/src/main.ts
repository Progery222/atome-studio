import "reflect-metadata";
import * as dotenv from "dotenv";

dotenv.config();

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

function checkEnv() {
  const warns: string[] = [];
  const errors: string[] = [];

  if (!process.env.JWT_SECRET) errors.push("JWT_SECRET не задан — авторизация не будет работать");

  const checks: Array<[string, string, string]> = [
    [
      "MINIO_URL",
      process.env.MINIO_URL ?? "http://localhost:9000",
      "Videos страница будет пустой в prod",
    ],
    ["MINIO_BUCKET", process.env.MINIO_BUCKET ?? "atome-videos", ""],
    [
      "SPORTZAVOD_URL",
      process.env.SPORTZAVOD_URL ?? "http://localhost:8000",
      "SportZavod генерация не будет работать в prod",
    ],
    [
      "CONTENTZAVOD_URL",
      process.env.CONTENTZAVOD_URL ?? "http://localhost:8002",
      "content-zavod генерация не будет работать в prod",
    ],
    [
      "ORCHESTRATOR_URL",
      process.env.ORCHESTRATOR_URL ?? "http://localhost:8001",
      "Farm данные не будут доступны в prod",
    ],
  ];

  for (const [name, value, hint] of checks) {
    if (value.includes("localhost") || value.includes("127.0.0.1")) {
      warns.push(`${name}=${value} (localhost${hint ? " — " + hint : ""})`);
    }
  }

  const bucket = process.env.MINIO_BUCKET ?? "atome-videos";
  if (bucket !== "atome-videos") {
    warns.push(
      `MINIO_BUCKET=${bucket} — ожидается 'atome-videos', иначе заводы пишут в другой бакет`
    );
  }

  for (const w of warns) console.warn(`[ENV] WARN  ${w}`);
  for (const e of errors) console.error(`[ENV] ERROR ${e}`);

  if (errors.length > 0) {
    console.error("[ENV] Исправь ошибки выше перед запуском");
    process.exit(1);
  }
}

async function bootstrap() {
  checkEnv();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.enableCors({ origin: true, credentials: true });
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Atome API running on port ${port}`);
}
bootstrap();
