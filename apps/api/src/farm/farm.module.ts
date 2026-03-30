import { Module } from '@nestjs/common'
import { FarmService }    from './farm.service'
import { FarmController } from './farm.controller'

@Module({
  providers:   [FarmService],
  controllers: [FarmController],
})
export class FarmModule {}
