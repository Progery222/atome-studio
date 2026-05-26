import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditEntry {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  target?: string | null;
  ip?: string | null;
  payload?: unknown;
  status?: "ok" | "error";
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          userEmail: entry.userEmail ?? null,
          action: entry.action,
          target: entry.target ?? null,
          ip: entry.ip ?? null,
          status: entry.status ?? "ok",
          payloadJson: (entry.payload as never) ?? undefined,
        },
      });
    } catch (e) {
      this.logger.warn(`audit write failed: ${(e as Error).message}`);
    }
  }

  async list(filters: { action?: string; userId?: string; limit?: number } = {}) {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 500);
    return this.prisma.auditLog.findMany({
      where: {
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.userId ? { userId: filters.userId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
