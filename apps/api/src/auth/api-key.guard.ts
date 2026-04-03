import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const key = req.headers["x-api-key"];
    return key === (process.env.API_KEY ?? "dev-api-key");
  }
}
