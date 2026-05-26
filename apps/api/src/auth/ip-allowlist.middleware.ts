import type { NextFunction, Request, Response } from "express";

function parseList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  return req.ip ?? "";
}

const PROTECTED = [/^\/api\/clients(\/|$)/i, /^\/api\/audit(\/|$)/i];

/**
 * Restrict /api/clients/* and /api/audit/* to IPs from ADMIN_ALLOWED_IPS env.
 * If env is empty, middleware is a no-op (useful in dev).
 * Always allows loopback (127.0.0.1, ::1).
 */
export function IpAllowlistMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = req.originalUrl || req.url || "";
  if (!PROTECTED.some((rx) => rx.test(path))) return next();

  const allowed = parseList(process.env.ADMIN_ALLOWED_IPS);
  if (allowed.length === 0) return next();

  const ip = clientIp(req);
  const loopback = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
  if (loopback || allowed.includes(ip)) return next();

  res.status(403).json({ message: "IP not allowed" });
}
