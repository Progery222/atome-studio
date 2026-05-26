import { Body, Controller, Get, HttpException, Param, Post, Query } from "@nestjs/common";
import { Audited } from "../audit/audited.decorator";
import { AutonomyService } from "./autonomy.service";

@Controller()
export class AutonomyController {
  constructor(private readonly autonomy: AutonomyService) {}

  // ── Sessions ───────────────────────────────────────────────────────────────

  @Get("autonomy/sessions")
  async listSessions(@Query("active_only") activeOnly?: string) {
    return this.autonomy.listSessions(activeOnly === "true");
  }

  @Get("autonomy/sessions/:serial")
  async getSession(@Param("serial") serial: string) {
    const detail = await this.autonomy.getSession(serial);
    if (!detail) throw new HttpException("Session not found", 404);
    return detail;
  }

  @Audited("autonomy.pause")
  @Post("autonomy/sessions/:serial/pause")
  async pauseSession(@Param("serial") serial: string) {
    return this.autonomy.pauseSession(serial);
  }

  @Audited("autonomy.resume")
  @Post("autonomy/sessions/:serial/resume")
  async resumeSession(@Param("serial") serial: string) {
    return this.autonomy.resumeSession(serial);
  }

  @Audited("autonomy.terminate")
  @Post("autonomy/sessions/:serial/terminate")
  async terminateSession(@Param("serial") serial: string) {
    return this.autonomy.terminateSession(serial);
  }

  @Get("autonomy/actions/:serial/recent")
  async listActions(@Param("serial") serial: string, @Query("limit") limit?: string) {
    const n = limit ? Number(limit) : 50;
    return this.autonomy.listActions(serial, Number.isFinite(n) ? n : 50);
  }

  @Get("autonomy/observations/:serial/recent")
  async listObservations(@Param("serial") serial: string, @Query("limit") limit?: string) {
    const n = limit ? Number(limit) : 20;
    return this.autonomy.listObservations(serial, Number.isFinite(n) ? n : 20);
  }

  // ── Anomalies & Recoveries ─────────────────────────────────────────────────

  @Get("autonomy/anomaly/events")
  async listAnomalies(
    @Query("severity") severity?: string,
    @Query("signature_id") signatureId?: string,
    @Query("since") since?: string
  ) {
    return this.autonomy.listAnomalies({
      severity,
      signature_id: signatureId,
      since,
    });
  }

  @Get("autonomy/recoveries/recent")
  async listRecoveries() {
    return this.autonomy.listRecoveries();
  }

  // ── Phone Goals ────────────────────────────────────────────────────────────

  @Get("goals")
  async listGoals(@Query("status") status?: string, @Query("serial") serial?: string) {
    return this.autonomy.listGoals({ status, serial });
  }

  @Get("goals/:serial/current")
  async getCurrentGoal(@Param("serial") serial: string) {
    const goal = await this.autonomy.getCurrentGoal(serial);
    if (!goal) throw new HttpException("No active goal", 404);
    return goal;
  }

  @Post("goals")
  async createGoal(@Body() body: Record<string, unknown>) {
    const goal = await this.autonomy.createGoal(body);
    if (!goal) throw new HttpException("Failed to create goal", 502);
    return goal;
  }

  // ── Global Goals ───────────────────────────────────────────────────────────

  @Get("global_goals")
  async listGlobalGoals() {
    return this.autonomy.listGlobalGoals();
  }

  @Post("global_goals")
  async createGlobalGoal(@Body() body: Record<string, unknown>) {
    const goal = await this.autonomy.createGlobalGoal(body);
    if (!goal) throw new HttpException("Failed to create global goal", 502);
    return goal;
  }
}
