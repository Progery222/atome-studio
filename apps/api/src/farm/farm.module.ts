import { Module } from "@nestjs/common";
import { FarmNodeProxyController } from "./farm-node-proxy.controller";
import { FarmController } from "./farm.controller";
import { FarmProxyController } from "./farm-proxy.controller";
import { FarmService } from "./farm.service";

@Module({
  providers: [FarmService],
  controllers: [FarmProxyController, FarmNodeProxyController, FarmController],
  exports: [FarmService],
})
export class FarmModule {}
