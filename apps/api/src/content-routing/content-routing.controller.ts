import { Body, Controller, Get, Post, Put, Query } from "@nestjs/common";
import { ContentRoutingService } from "./content-routing.service";

@Controller("content-routing")
export class ContentRoutingController {
  constructor(private readonly routing: ContentRoutingService) {}

  @Get("themes")
  getThemes() {
    return this.routing.getThemes();
  }

  @Post("scan-minio")
  scanMinio() {
    return this.routing.scanMinio();
  }

  @Post("build-manifests")
  buildManifests() {
    return this.routing.buildManifests();
  }

  @Get("rules")
  getRules(
    @Query("phone_id") phoneId?: string,
    @Query("account_id") accountId?: string,
  ) {
    return this.routing.getRules({ phoneId, accountId });
  }

  @Put("rules")
  putRule(@Body() body: unknown) {
    return this.routing.saveRule(body);
  }

  @Get("videos")
  getVideos(
    @Query("service_key") serviceKey?: string,
    @Query("theme_key") themeKey?: string,
    @Query("status") status?: string,
  ) {
    return this.routing.getVideos({ serviceKey, themeKey, status });
  }

  @Post("deliveries")
  recordDelivery(@Body() body: unknown) {
    return this.routing.recordDelivery(body);
  }
}
