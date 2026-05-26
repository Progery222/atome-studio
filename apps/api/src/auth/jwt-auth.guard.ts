import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { IS_PUBLIC_KEY } from "./public.decorator";

function addToken(tokens: string[], token: string | undefined): void {
  if (token && !tokens.includes(token)) tokens.push(token);
}

function readCookieTokens(rawCookie: string | undefined): string[] {
  if (!rawCookie) return [];
  const tokens: string[] = [];

  for (const part of rawCookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== "at") continue;

    try {
      addToken(tokens, decodeURIComponent(rest.join("=")));
    } catch {
      addToken(tokens, rest.join("="));
    }
  }

  return tokens;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Skip guard for routes decorated with @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      cookies?: Record<string, string>;
    }>();
    const authHeader = req.headers.authorization;
    const tokens: string[] = [];

    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      addToken(tokens, authHeader.slice(7));
    }
    if (Array.isArray(authHeader)) {
      for (const item of authHeader) {
        if (item.startsWith("Bearer ")) addToken(tokens, item.slice(7));
      }
    }

    for (const token of readCookieTokens(req.headers.cookie as string | undefined)) {
      addToken(tokens, token);
    }
    addToken(tokens, req.cookies?.at);

    if (tokens.length === 0) {
      throw new UnauthorizedException("Missing auth token");
    }

    for (const token of tokens) {
      try {
        const payload = this.jwt.verify(token) as Record<string, unknown>;
        // Attach decoded payload to request for use in controllers
        (req as unknown as Record<string, unknown>).user = payload;
        return true;
      } catch {
        // Try the next candidate. Browsers can send duplicate cookie names when
        // old path/domain variants exist, and cookie-parser exposes only one.
      }
    }

    throw new UnauthorizedException("Invalid or expired token");
  }
}
