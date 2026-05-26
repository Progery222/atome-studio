import { All, Controller, Req, Res } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { FarmService } from "./farm.service";

@SkipThrottle()
@Controller("farm")
export class FarmProxyController {
  constructor(private readonly farm: FarmService) {}

  @All()
  proxyRoot(@Req() req: Request, @Res() res: Response) {
    return this.farm.proxyFarmRequest(req, res);
  }

  @All("*")
  proxyPath(@Req() req: Request, @Res() res: Response) {
    return this.farm.proxyFarmRequest(req, res);
  }
}
