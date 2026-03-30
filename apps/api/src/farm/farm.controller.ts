import { Controller, Get, Post, Param, Body, NotFoundException } from '@nestjs/common'
import { FarmService } from './farm.service'
import { Account } from '@atome/shared'

@Controller()
export class FarmController {
  constructor(private readonly farm: FarmService) {}

  @Get('phones')
  getPhones() {
    return this.farm.getPhones()
  }

  @Get('phones/:id')
  async getPhone(@Param('id') id: string) {
    const phone = await this.farm.getPhone(id)
    if (!phone) throw new NotFoundException(`Phone ${id} not found`)
    return phone
  }

  @Post('phones/:id/pause')
  pausePhone(@Param('id') id: string) {
    return this.farm.pausePhone(id)
  }

  @Post('phones/:id/resume')
  resumePhone(@Param('id') id: string) {
    return this.farm.resumePhone(id)
  }

  @Get('accounts')
  getAccounts() {
    return this.farm.getAccounts()
  }

  @Post('accounts')
  createAccount(@Body() body: Partial<Account>) {
    return this.farm.createAccount(body)
  }
}
