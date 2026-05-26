import type { Account } from "@atome/shared";
import { SkipThrottle } from "@nestjs/throttler";
import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { FarmService } from "./farm.service";

@SkipThrottle()
@Controller()
export class FarmController {
  constructor(private readonly farm: FarmService) {}

  // ---- Publish analytics (proxy в atome-farm /api/publish/*) ----

  @Get("publish/events")
  publishEvents(
    @Query("since_min") sinceMin?: string,
    @Query("phone_id") phoneId?: string,
    @Query("platform") platform?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
  ) {
    return this.farm.getPublishEvents({
      since_min: sinceMin ? Number(sinceMin) : 60,
      phone_id: phoneId,
      platform,
      status,
      limit: limit ? Number(limit) : 200,
    });
  }

  @Get("publish/timeline/:taskId")
  publishTimeline(@Param("taskId") taskId: string) {
    return this.farm.getPublishTimeline(taskId);
  }

  @Get("publish/stats")
  publishStats(@Query("since_min") sinceMin?: string) {
    return this.farm.getPublishStats(sinceMin ? Number(sinceMin) : 1440);
  }

  // ---- Account groups proxy в atome-farm ----

  @Get("content-services")
  listContentServices() {
    return this.farm.proxyGet("/api/content-services");
  }

  @Get("content-pools")
  listContentPools(
    @Query("service_key") serviceKey?: string,
    @Query("status") status?: string,
  ) {
    const qs = new URLSearchParams();
    if (serviceKey) qs.set("service_key", serviceKey);
    if (status) qs.set("status", status);
    return this.farm.proxyGet(`/api/content-pools${qs.toString() ? `?${qs.toString()}` : ""}`);
  }

  @Post("content-pools")
  createContentPool(@Body() body: unknown) {
    return this.farm.proxyPost("/api/content-pools", body);
  }

  @Post("content-pools/ensure")
  ensureContentPool(@Body() body: unknown) {
    return this.farm.proxyPost("/api/content-pools/ensure", body);
  }

  @Post("content-pools/sync/sportzavod-themes")
  async syncSportzavodThemePools() {
    const themes = await this.farm.getSportzavodThemes();
    const pools: unknown[] = [];
    for (const theme of themes) {
      const pool = await this.farm.proxyPost("/api/content-pools/ensure", {
        service_key: "sportzavod",
        source_key: theme.theme_key,
        name: theme.theme_name || theme.theme_key,
        description: `${theme.count ?? 0} SportZavod accounts`,
        meta: theme,
      });
      pools.push(pool);
    }
    return { ok: true, count: pools.length, pools };
  }

  @Patch("content-pools/:id")
  updateContentPool(@Param("id") id: string, @Body() body: unknown) {
    return this.farm.proxyPatch(`/api/content-pools/${id}`, body);
  }

  @Post("content-pools/:id/pause")
  pauseContentPool(@Param("id") id: string) {
    return this.farm.proxyPost(`/api/content-pools/${id}/pause`, {});
  }

  @Post("content-pools/:id/block")
  blockContentPool(@Param("id") id: string) {
    return this.farm.proxyPost(`/api/content-pools/${id}/block`, {});
  }

  @Post("content-pools/:id/archive")
  archiveContentPool(@Param("id") id: string) {
    return this.farm.proxyPost(`/api/content-pools/${id}/archive`, {});
  }

  @Get("account-groups")
  listGroups() {
    return this.farm.proxyGet("/api/account-groups");
  }

  @Post("account-groups")
  createGroup(@Body() body: unknown) {
    return this.farm.proxyPost("/api/account-groups", body);
  }

  @Patch("account-groups/:gid")
  updateGroup(@Param("gid") gid: string, @Body() body: unknown) {
    return this.farm.proxyPatch(`/api/account-groups/${gid}`, body);
  }

  @Get("account-groups/:gid/accounts")
  groupAccounts(@Param("gid") gid: string) {
    return this.farm.proxyGet(`/api/account-groups/${gid}/accounts`);
  }

  @Post("account-groups/:gid/accounts")
  addGroupAccount(@Param("gid") gid: string, @Body() body: unknown) {
    return this.farm.proxyPost(`/api/account-groups/${gid}/accounts`, body);
  }

  @Get("account-groups/:gid/pools")
  groupPools(@Param("gid") gid: string) {
    return this.farm.proxyGet(`/api/account-groups/${gid}/pools`);
  }

  @Post("account-groups/:gid/pools")
  addGroupPool(@Param("gid") gid: string, @Body() body: unknown) {
    return this.farm.proxyPost(`/api/account-groups/${gid}/pools`, body);
  }

  @Post("account-groups/:gid/assign")
  assignAccounts(@Param("gid") gid: string, @Body() body: unknown) {
    return this.farm.proxyPost(`/api/account-groups/${gid}/assign`, body);
  }

  @Get("videos/assets")
  listVideoAssets(
    @Query("service_key") serviceKey?: string,
    @Query("pool_key") poolKey?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
  ) {
    const qs = new URLSearchParams();
    if (serviceKey) qs.set("service_key", serviceKey);
    if (poolKey) qs.set("pool_key", poolKey);
    if (status) qs.set("status", status);
    if (limit) qs.set("limit", limit);
    return this.farm.proxyGet(`/api/videos${qs.toString() ? `?${qs.toString()}` : ""}`);
  }

  @Post("account-import/sportzavod")
  importSportzavod(@Body() body: unknown) {
    return this.farm.proxyPost("/api/account-import/sportzavod", body);
  }

  // ---- Существующие phone/account endpoints ----

  @Get("phones")
  getPhones() {
    return this.farm.getPhones();
  }

  @Get("phones/:id")
  async getPhone(@Param("id") id: string) {
    const phone = await this.farm.getPhone(id);
    if (!phone) throw new NotFoundException(`Phone ${id} not found`);
    return phone;
  }

  @Post("phones/:id/pause")
  pausePhone(@Param("id") id: string) {
    return this.farm.pausePhone(id);
  }

  @Post("phones/:id/resume")
  resumePhone(@Param("id") id: string) {
    return this.farm.resumePhone(id);
  }

  @Get("accounts")
  getAccounts() {
    return this.farm.getAccounts();
  }

  @Get("accounts/:id/content-pools")
  accountContentPools(@Param("id") id: string) {
    return this.farm.proxyGet(`/api/accounts/${encodeURIComponent(id)}/content-pools`);
  }

  @Put("accounts/:id/content-pools")
  replaceAccountContentPools(@Param("id") id: string, @Body() body: unknown) {
    return this.farm.proxyPut(`/api/accounts/${encodeURIComponent(id)}/content-pools`, body);
  }

  @Get("accounts/:id")
  async getAccount(@Param("id") id: string) {
    const acc = await this.farm.getAccount(id);
    if (!acc) throw new NotFoundException(`Account ${id} not found`);
    return acc;
  }

  @Post("accounts")
  createAccount(@Body() body: Partial<Account>) {
    return this.farm.createAccount(body);
  }

  @Patch("accounts/:id")
  updateAccount(@Param("id") id: string, @Body() body: Partial<Account>) {
    return this.farm.updateAccount(id, body);
  }

  @Get("sportzavod/accounts")
  getSportzavodAccounts() {
    return this.farm.getSportzavodAccounts();
  }

  @Post("sportzavod/accounts/reload")
  reloadAccounts() {
    return this.farm.reloadAccounts();
  }

  @Get("sportzavod/themes")
  getSportzavodThemes() {
    return this.farm.getSportzavodThemes();
  }
}
