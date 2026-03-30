# Atome Studio — Claude Instructions

## Контекст проекта

TikTok content farm dashboard. Управляет фермой телефонов, генерацией видео (SportZavod + content-zavod) и публикацией через Orchestrator.

**Монорепо:**
- `apps/web` — React 18 + TypeScript + Three.js + Zustand (порт 5173)
- `apps/api` — NestJS + TypeScript (порт 3001)
- `packages/shared` — общие TypeScript типы

---

## Файлы ТЗ и трекинга

| Файл | Что содержит |
|------|-------------|
| `TZ_DASHBOARD.md` | Актуальное ТЗ: экраны, FR-требования, API контракты, макеты |
| `tz_atom_studio.md` | Визуальная концепция 3D галактики (уже реализована) |
| `PROGRESS.md` | **Чеклист прогресса по шагам** — обновляй после каждого завершённого шага |

---

## Правила работы

1. **Перед началом** — прочитай `PROGRESS.md`, найди первый незакрытый шаг (`[ ]`)
2. **Реализуй один шаг за раз** из `PROGRESS.md`
3. **После завершения** — отметь `[x]` в `PROGRESS.md`
4. **Не переходи к следующей фазе**, пока текущая не протестирована по условию 🧪 Тест
5. **При изменении типов** — добавляй в `packages/shared/src/index.ts`, не дублируй в app-пакетах

---

## Архитектура

### Backend (`apps/api/src/`)
```
mcp/                    ← адаптеры к внешним сервисам
  cloudflare/           ← паттерн адаптера (пример для новых)
  postman/
  posthog/
  sportzavod/           ← создать: GET :8000/health, /api/jobs
  farm/                 ← создать: GET :8001/status, /api/devices
  contentzavod/         ← создать: GET :8002/health
services/               ← ServicesService (polling каждые 30с), ServicesController
auth/                   ← JWT авторизация (уже есть)
generation/             ← создать: POST /api/generate, GET /api/jobs/:id
events/                 ← создать: EventsGateway (WS мост к orchestrator)
videos/                 ← создать: MinioService, GET /api/videos
clients/                ← создать: CRUD клиентов
```

### Frontend (`apps/web/src/`)
```
stores/
  services.ts           ← главный store (Service[], metrics, tooltip)
  farm.ts               ← создать: Phone[], Account[], QueueTask[], WS events
components/
  AtomicCanvas/         ← Three.js галактика (не трогать без нужды)
  SidePanel/            ← боковая панель деталей сервиса
  Tooltip/              ← переиспользовать в phone cards
  Sparkline/            ← переиспользовать для health_score графиков
  GalaxyWidgets/        ← создать: 4 виджета поверх Galaxy
  Layout/               ← создать: sidebar навигация
  AuthGuard/            ← создать: защита маршрутов
  CreateAccountModal/   ← создать: модалка создания аккаунта
pages/
  Phones/               ← создать: /phones
  PhoneDetail/          ← создать: /phones/:id
  Accounts/             ← создать: /accounts
  AccountDetail/        ← создать: /accounts/:id
  Generate/             ← создать: /generate
  Queue/                ← создать: /queue
  Videos/               ← создать: /videos
  Clients/              ← создать: /clients (super_admin)
  Login/                ← создать: /login
```

---

## Порты сервисов

| Сервис | Порт |
|--------|------|
| Dashboard Web | 5173 |
| Dashboard API (NestJS) | 3001 |
| Orchestrator (FastAPI) | 8001 |
| SportZavod | 8000 |
| content-zavod | 8002 |
| MinIO API | 9000 |
| MinIO UI | 9001 |

---

## Ключевые API контракты

### Dashboard API → Orchestrator `:8001`
```
GET  /health                          → статус
GET  /api/status                      → сводка фермы
GET  /api/devices                     → список телефонов
GET  /api/devices/:phone_id           → детали телефона
POST /api/devices/:phone_id/pause     → пауза
POST /api/devices/:phone_id/resume    → возобновить
GET  /api/accounts                    → список аккаунтов
POST /api/accounts                    → создать аккаунт
GET  /api/metrics                     → метрики
WS   /ws/events                       → real-time события
```

### Dashboard API → SportZavod `:8000`
```
GET  /health                          → статус
POST /api/generate                    → запуск генерации
GET  /api/jobs                        → список jobs
GET  /api/jobs/:id                    → статус job
POST /api/jobs/:id/stop               → отмена
GET  /api/accounts                    → список аккаунтов SportZavod
POST /api/accounts/reload             → перезагрузка из Google Sheets
```

### Dashboard API → content-zavod `:8002`
```
GET  /health                          → статус
POST /api/generate                    → { account_id, topic, videos_per_account }
GET  /api/jobs/:id                    → статус
```

---

## Модели данных (в `packages/shared/src/index.ts`)

Основные интерфейсы из ТЗ для добавления в shared:
- `Phone` — телефон фермы (phone_id, serial, status, warmup_day, health_score, accounts[])
- `Account` — TikTok аккаунт (account_id, username, niche, content_sources[], stats)
- `QueueTask` — задача публикации (task_id, account_id, file_url, status, scheduled_at)
- `FarmEvent` — WS событие (event: published|banned|error|heartbeat|job_complete)
- `VideoFile` — видео в MinIO (filename, url, thumbnail_url, status)
- `GenerationJob` — задание генерации (job_id, service, progress, status)

---

## Команды

```bash
npm run dev          # web + api одновременно
npm run dev:web      # только фронтенд
npm run dev:api      # только бэкенд
docker compose up    # вся инфраструктура
```

---

## Стиль кода

- TypeScript строгий — `strict: true`
- CSS Modules для стилей компонентов
- Zustand для всего состояния (не React state для глобальных данных)
- Компоненты в отдельных папках с `index.ts` реэкспортом
- Адаптеры в `apps/api/src/mcp/` — следовать паттерну `cloudflare.adapter.ts`
