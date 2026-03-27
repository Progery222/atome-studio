---
name: project-backend
description: Используй этот скилл при работе с бэкендом Atome Studio — NestJS модули, API эндпоинты, база данных, миграции, интеграции с платформами (Cloudflare, PostHog, Postman), авторизация JWT, WebSocket, очереди BullMQ, кэширование Redis. Активируй при словах: бэкенд, API, эндпоинт, NestJS, контроллер, сервис, модуль, миграция, PostgreSQL, Redis, JWT, авторизация, WebSocket, очередь, polling, адаптер платформы, Cloudflare API, PostHog API, Postman API.
---

# Atome Studio — Backend-разработка

Скилл для бэкенд-разработки проекта Atome Studio.

## Стек

- **NestJS** (TypeScript, strict mode)
- **PostgreSQL** — основная БД
- **TypeORM** или **Prisma** — ORM
- **Redis** — кэш + очереди
- **BullMQ** — фоновые задачи (polling платформ)
- **JWT** — аутентификация (access + refresh tokens)
- **WebSocket** (Socket.io через NestJS Gateway) — real-time

## Структура `apps/api/src/`

```
src/
├── auth/                    # Модуль аутентификации
│   ├── auth.module.ts
│   ├── auth.controller.ts   # POST /auth/register, /auth/login, /auth/refresh
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   └── guards/
├── workspaces/              # Рабочие пространства
│   ├── workspaces.module.ts
│   ├── workspaces.controller.ts
│   └── workspaces.service.ts
├── platforms/               # Адаптеры платформ
│   ├── platforms.module.ts
│   ├── platforms.service.ts # Общая логика
│   ├── platform.adapter.ts # Интерфейс адаптера
│   ├── cloudflare/
│   │   ├── cloudflare.adapter.ts
│   │   └── cloudflare.types.ts
│   ├── posthog/
│   │   ├── posthog.adapter.ts
│   │   └── posthog.types.ts
│   └── postman/
│       ├── postman.adapter.ts
│       └── postman.types.ts
├── services/                # Сервисы (сущности из платформ)
│   ├── services.module.ts
│   ├── services.controller.ts
│   └── services.service.ts
├── alerts/                  # Алерты и нотификации
│   ├── alerts.module.ts
│   ├── alerts.service.ts
│   └── alerts.gateway.ts   # WebSocket gateway
├── polling/                 # Фоновый polling
│   ├── polling.module.ts
│   ├── polling.processor.ts # BullMQ processor
│   └── polling.service.ts
├── common/                  # Общие утилиты
│   ├── decorators/
│   ├── filters/
│   ├── interceptors/
│   └── crypto.service.ts   # Шифрование API-ключей
└── app.module.ts
```

## API эндпоинты

Полный список: см. раздел 10 в `tz_atom_studio.md`.

### Ключевые:
- `POST /api/auth/register` — регистрация
- `POST /api/auth/login` — авторизация → JWT
- `GET /api/workspaces/:id/services` — все сервисы workspace
- `POST /api/workspaces/:id/connections` — подключить платформу
- `POST /api/connections/:id/sync` — принудительная синхронизация
- WebSocket: `service:status_changed`, `service:metrics_updated`, `alert:created`

## Интерфейс адаптера платформы

```typescript
export interface PlatformAdapter {
  readonly platform: PlatformType;
  validateCredentials(credentials: Record<string, string>): Promise<boolean>;
  fetchServices(connection: PlatformConnection): Promise<ServiceData[]>;
  getServiceDetails(connection: PlatformConnection, serviceId: string): Promise<ServiceDetails>;
  getMetrics?(connection: PlatformConnection, serviceId: string): Promise<MetricData[]>;
}
```

Каждый новый адаптер реализует этот интерфейс и регистрируется в `PlatformsModule`.

## Правила разработки

1. **Модульность NestJS** — каждая функциональная область = отдельный module
2. **DTO валидация** — class-validator для всех входящих данных
3. **Шифрование** — API-ключи платформ шифруются AES-256 перед сохранением
4. **Кэширование** — данные от платформ кэшируются в Redis (TTL = polling interval)
5. **Error handling** — глобальный exception filter, кастомные исключения
6. **Логирование** — NestJS Logger, structured JSON logs
7. **Тестирование** — unit-тесты для сервисов, e2e для контроллеров

## Шаблон NestJS контроллера

```typescript
@Controller('api/services')
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get(':workspaceId')
  async getServices(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: User,
  ): Promise<ServiceResponseDto[]> {
    return this.servicesService.findByWorkspace(workspaceId, user.id);
  }
}
```

## Polling flow

1. При создании `PlatformConnection` — создаётся repeatable job в BullMQ
2. Job выполняется с интервалом (default: 60 сек)
3. Processor вызывает `adapter.fetchServices(connection)`
4. Сравнивает с текущими данными в БД
5. При изменении статуса — обновляет БД + отправляет WebSocket event + создаёт Alert
