import { All, Controller, Req, Res } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { Public } from "../auth/public.decorator";
import { FarmService } from "./farm.service";

@Public()
@SkipThrottle()
@Controller("nodes")
export class FarmNodeProxyController {
  constructor(private readonly farm: FarmService) {}

  @All("heartbeat")
  proxyHeartbeat(@Req() req: Request, @Res() res: Response) {
    return this.farm.proxyNodeAgentRequest(req, res);
  }

  @All(":nodeId/commands")
  proxyCommands(@Req() req: Request, @Res() res: Response) {
    return this.farm.proxyNodeAgentRequest(req, res);
  }

  @All(":nodeId/results")
  proxyResults(@Req() req: Request, @Res() res: Response) {
    return this.farm.proxyNodeAgentRequest(req, res);
  }
}
