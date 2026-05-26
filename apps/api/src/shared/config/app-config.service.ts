import { Injectable } from "@nestjs/common";
import { type AppConfig, loadAppConfig } from "./env";

@Injectable()
export class AppConfigService {
  readonly values: AppConfig = loadAppConfig();
}
