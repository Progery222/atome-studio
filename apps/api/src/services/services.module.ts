import { Module } from "@nestjs/common";
import { McpModule } from "../mcp/mcp.module";
import { ServicesController } from "./services.controller";
import { ServicesService } from "./services.service";

@Module({
  imports: [McpModule],
  controllers: [ServicesController],
  providers: [ServicesService],
})
export class ServicesModule {}
