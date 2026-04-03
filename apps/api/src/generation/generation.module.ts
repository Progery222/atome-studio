import { Module } from "@nestjs/common";
import { GenerationController } from "./generation.controller";
import { GenerationService } from "./generation.service";

@Module({
  providers: [GenerationService],
  controllers: [GenerationController],
})
export class GenerationModule {}
