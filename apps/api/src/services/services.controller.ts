import { Controller, Get, NotFoundException, Param, Post } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import type { ServicesService } from "./services.service";

@Public()
@Controller("services")
export class ServicesController {
  constructor(private readonly svc: ServicesService) {}

  @Get()
  getAll() {
    return this.svc.getAll();
  }

  @Get("stats")
  getStats() {
    return this.svc.getFarmStats();
  }

  @Get("kpis")
  getKPIs() {
    return this.svc.getHeroKPIs();
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    const service = this.svc.getById(id);
    if (!service) throw new NotFoundException(`Service ${id} not found`);
    return service;
  }

  @Post("sync")
  async sync() {
    await this.svc.sync();
    return { ok: true, count: this.svc.getAll().length };
  }
}
