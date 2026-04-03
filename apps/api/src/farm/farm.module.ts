import { Module } from "@nestjs/common";
import { FarmController } from "./farm.controller";
import { FarmService } from "./farm.service";

@Module({
  providers: [FarmService],
  controllers: [FarmController],
})
export class FarmModule {}
