import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { AppConfigService } from "../shared/config/app-config.service";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const key = req.headers["x-api-key"];
    return key === this.config.values.apiKey;
  }
}
