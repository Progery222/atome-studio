import { Controller, Get, Post, Patch, Param, Body, NotFoundException } from '@nestjs/common'
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

  @Get('accounts/:id')
  async getAccount(@Param('id') id: string) {
    const acc = await this.farm.getAccount(id)
    if (!acc) throw new NotFoundException(`Account ${id} not found`)
    return acc
  }

  @Post('accounts')
  createAccount(@Body() body: Partial<Account>) {
    return this.farm.createAccount(body)
  }

  @Patch('accounts/:id')
  updateAccount(@Param('id') id: string, @Body() body: Partial<Account>) {
    return this.farm.updateAccount(id, body)
  }

  @Get('sportzavod/accounts')
  getSportzavodAccounts() {
    return this.farm.getSportzavodAccounts()
  }

  @Post('sportzavod/accounts/reload')
  reloadAccounts() {
    return this.farm.reloadAccounts()
  }
}
