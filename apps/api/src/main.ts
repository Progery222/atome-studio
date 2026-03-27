import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')
  app.enableCors({ origin: 'http://localhost:3000', credentials: true })
  await app.listen(4000)
  console.log('Atome API running on http://localhost:4000')
}
bootstrap()
