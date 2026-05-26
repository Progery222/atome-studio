import "reflect-metadata";
import { setDefaultResultOrder } from "node:dns";
import * as dotenv from "dotenv";

dotenv.config();

// Railway иногда возвращает IPv6 адреса которые не работают внутри internal сети.
setDefaultResultOrder("ipv4first");

import * as cookieParser from "cookie-parser";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { CsrfMiddleware } from "./auth/csrf.middleware";
import { IpAllowlistMiddleware } from "./auth/ip-allowlist.middleware";
import { installFarmWsProxy } from "./farm/farm-ws-proxy";
import { AppConfigService } from "./shared/config/app-config.service";
import { validateEnv } from "./shared/config/env";

async function bootstrap() {
  const log = new Logger("Bootstrap");
  try {
    const { warnings } = validateEnv();
    for (const warning of warnings) log.warn(warning);
  } catch (error) {
    log.error(`Invalid environment: ${(error as Error).message}`);
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(cookieParser());
  app.use(IpAllowlistMiddleware);
  app.use(CsrfMiddleware);
  app.setGlobalPrefix("api");
  app.enableCors({ origin: true, credentials: true });
  // Health endpoint outside /api prefix — used by Railway to detect liveness
  app.getHttpAdapter().get("/health", (_req: unknown, res: { json: (o: unknown) => void }) => {
    res.json({ status: "ok", uptime: Math.floor(process.uptime()) });
  });
  const port = app.get(AppConfigService).values.port;
  await app.listen(port, "0.0.0.0");
  installFarmWsProxy(app.getHttpServer(), app.get(JwtService));
  log.log(`Atome API running on port ${port}`);
}
bootstrap();
