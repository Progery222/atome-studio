import "reflect-metadata";
import * as dotenv from "dotenv";

dotenv.config();

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.enableCors({ origin: true, credentials: true });
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Atome API running on port ${port}`);
}
bootstrap();
