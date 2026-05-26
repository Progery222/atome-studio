import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  SetMetadata,
  UseInterceptors,
  applyDecorators,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { type Observable, catchError, tap, throwError } from "rxjs";
import { AuditService } from "./audit.service";

export const AUDIT_ACTION = "AUDIT_ACTION";

/** @Audited("generate.run") — marks a controller method for audit logging. */
export function Audited(action: string) {
  return applyDecorators(SetMetadata(AUDIT_ACTION, action), UseInterceptors(AuditInterceptor));
}

function clientIp(req: Request): string | undefined {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  return req.ip;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string>(AUDIT_ACTION, ctx.getHandler());
    if (!action) return next.handle();

    const req = ctx.switchToHttp().getRequest<Request & { user?: Record<string, unknown> }>();
    const user = req.user ?? {};
    const target =
      (req.params as Record<string, string | undefined>)?.id ??
      (req.params as Record<string, string | undefined>)?.serial ??
      undefined;
    const baseEntry = {
      userId: (user.sub as string | undefined) ?? null,
      userEmail: (user.email as string | undefined) ?? null,
      action,
      target,
      ip: clientIp(req) ?? null,
    };

    return next.handle().pipe(
      tap(() => {
        this.audit.log({
          ...baseEntry,
          status: "ok",
          payload: {
            method: req.method,
            url: req.originalUrl || req.url,
            body: (req as Request & { body?: unknown }).body,
          },
        });
      }),
      catchError((err) => {
        this.audit.log({
          ...baseEntry,
          status: "error",
          payload: {
            method: req.method,
            url: req.originalUrl || req.url,
            error: (err as Error).message,
          },
        });
        return throwError(() => err);
      })
    );
  }
}
