import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { Public } from "./public.decorator";

const AUTH_COOKIE = "at";
const CSRF_COOKIE = "csrf";
const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isSecureRequest(req: Request): boolean {
  const proto = req.headers["x-forwarded-proto"];
  return req.secure || proto === "https" || (Array.isArray(proto) && proto.includes("https"));
}

function cookieDomains(req?: Request): Array<string | undefined> {
  const host = (req?.hostname || req?.headers.host?.split(":")[0] || "").toLowerCase();
  const domains: Array<string | undefined> = [undefined];

  if (host && host !== "localhost" && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    domains.push(host);
    domains.push(`.${host}`);
  }

  return domains;
}

function clearCookieVariants(res: Response, name: string, req?: Request) {
  for (const domain of cookieDomains(req)) {
    res.clearCookie(name, {
      path: "/",
      sameSite: "lax",
      ...(domain ? { domain } : {}),
    });
  }
}

function setAuthCookie(res: Response, req: Request, token: string) {
  clearCookieVariants(res, AUTH_COOKIE, req);
  res.cookie("at", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(req),
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  });
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post("register")
  async register(
    @Body() body: { email: string; password: string; name: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.auth.register(body.email, body.password, body.name);
    setAuthCookie(res, req, result.access_token);
    return result;
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post("login")
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.auth.login(body.email, body.password);
    setAuthCookie(res, req, result.access_token);
    return result;
  }

  @Public()
  @Post("logout")
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    clearCookieVariants(res, AUTH_COOKIE, req);
    clearCookieVariants(res, CSRF_COOKIE, req);
    return { ok: true };
  }

  @Get("me")
  me(@Req() req: Request) {
    const user = (req as Request & { user?: Record<string, unknown> }).user;
    return user ? { user } : { user: null };
  }
}
