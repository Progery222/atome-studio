import type { Client } from "@atome/shared";
import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import { ClientsService } from "./clients.service";

@Controller()
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get("clients")
  getClients() {
    return this.clients.getClients();
  }

  @Post("clients")
  createClient(@Body() body: Partial<Client>) {
    return this.clients.createClient(body);
  }

  @Patch("clients/:id")
  async updateClient(@Param("id") id: string, @Body() body: Partial<Client>) {
    const result = await this.clients.updateClient(id, body);
    if (!result) throw new NotFoundException(`Client ${id} not found`);
    return result;
  }

  @Post("clients/:id/assign-phones")
  assignPhones(@Param("id") id: string, @Body() body: { phone_ids: string[] }) {
    return this.clients.assignPhones(id, body.phone_ids ?? []);
  }
}
