import { Module } from '@nestjs/common'
import { GenerationService }    from './generation.service'
import { GenerationController } from './generation.controller'

@Module({
  providers:   [GenerationService],
  controllers: [GenerationController],
})
export class GenerationModule {}
