import type { NextFunction, Request, Response } from "express";
import { randomBytes } from "node:crypto";

const CSRF_COOKIE = "csrf";
const HEADER = "x-csrf-token";
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Double-submit CSRF protection.
 * - On any request without a CSRF cookie — set one (not httpOnly so JS can read).
 * - For unsafe methods under /api/* require header X-CSRF-Token == cookie.
 * - Skip: /api/auth/login, /api/auth/register (user has no session yet).
 * - Skip: requests using Bearer Authorization (legacy clients / CLI / service accounts).
 */
export function CsrfMiddleware(req: Request, res: Response, next: NextFunction) {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
  let token = cookies[CSRF_COOKIE];
  if (!token) {
    token = randomBytes(24).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: "lax",
      secure: req.secure,
      path: "/",
      maxAge: 8 * 60 * 60 * 1000,
    });
  }

  const url = req.originalUrl || req.url || "";
  if (!UNSAFE.has(req.method)) return next();
  if (!url.startsWith("/api/")) return next();
  if (
    url.startsWith("/api/auth/login") ||
    url.startsWith("/api/auth/register") ||
    url.startsWith("/api/auth/logout")
  ) {
    return next();
  }
  if (url.startsWith("/api/nodes/")) {
    return next();
  }

  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return next();

  const provided = req.headers[HEADER];
  if (typeof provided === "string" && provided.length > 0 && provided === token) return next();

  res.status(403).json({ message: "CSRF token mismatch" });
}
