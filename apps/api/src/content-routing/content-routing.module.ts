import { Module } from "@nestjs/common";
import { FarmModule } from "../farm/farm.module";
import { ContentRoutingController } from "./content-routing.controller";
import { ContentRoutingService } from "./content-routing.service";

@Module({
  imports: [FarmModule],
  controllers: [ContentRoutingController],
  providers: [ContentRoutingService],
  exports: [ContentRoutingService],
})
export class ContentRoutingModule {}
