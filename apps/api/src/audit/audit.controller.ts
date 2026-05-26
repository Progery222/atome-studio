import { Controller, Get, Query } from "@nestjs/common";
import { AuditService } from "./audit.service";

@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Query("action") action?: string,
    @Query("userId") userId?: string,
    @Query("limit") limit?: string
  ) {
    return this.audit.list({
      action,
      userId,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }
}
