# Atome Studio — Claude Instructions

## Контекст проекта

TikTok content farm dashboard. Управляет фермой телефонов, генерацией видео (SportZavod + content-zavod) и публикацией через Orchestrator.

**Монорепо:**
- `apps/web` — React 18 + TypeScript + Three.js + Zustand (порт 5173)
- `apps/api` — NestJS + TypeScript (порт 3001)
- `packages/shared` — общие TypeScript типы

---

## Standalone файлы

- `atomic_monitor.html` — автономный дашборд мониторинга (без сборки, открывается в браузере напрямую). Не часть монорепо, не трогать без нужды. 5 орбитальных колец (CF, PostHog, Postman, Cyan, Gold) с 3-слойным glow (широкое свечение + ядро + белый core) и спарклами на передних сегментах; центральная планета: белое горячее ядро, анимированные световые лучи, экваториальный пылевой диск (60 частиц), энергетическая турбулентность, экваториальные полосы; боковая панель метрик.
- `apps/api/Dockerfile` — multi-stage Docker образ для деплоя API. Build context — корень монорепо (нужен для `packages/shared`). Билдит shared → api, запускает `node dist/main` на порту 3001.

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
mcp/                    ← адаптеры к внешним сервисам (cloudflare, postman, posthog, sportzavod, farm, contentzavod)
services/               ← ServicesService (polling каждые 30с), ServicesController, GET /api/services/kpis
auth/                   ← JWT авторизация, in-memory users (admin@atome.studio / admin123)
generation/             ← POST /api/generate, GET /api/jobs/:id; эмитит job_started/job_complete/job_stopped через EventsGateway
events/                 ← EventsGateway (Socket.io WS мост к orchestrator); экспортируется из EventsModule; метод emit(FarmEvent) для внутреннего использования
videos/                 ← VideosService (S3 XML API к MinIO), GET /api/videos
clients/                ← CRUD клиентов (super_admin only)
metrics/                ← MetricsService (in-memory time-series), GET /api/metrics/history
```

### Frontend (`apps/web/src/`)
```
stores/
  services.ts           ← главный store (Service[], metrics, tooltip); fetchServices пушит ActivityEvent при смене статуса сервиса
  farm.ts               ← Phone[], Account[], QueueTask[], WS events; fetchJobs пушит synthetic ActivityEvent (job progress/done/error) когда wsConnected=false
  metrics.ts            ← kpis: HeroKPI, fetchKPIs()
  activity.ts           ← кольцевой буфер ActivityEvent (max 50)
  auth.ts               ← useAuthStore — JWT token, user, login/logout
  lang.ts               ← useLangStore — текущий язык (ru/en/zh/es)
i18n/
  index.ts              ← ~280 ключей, 4 локали; useT() хук; getT() для не-React кода; LOCALE_MAP
components/
  AtomicCanvas/         ← Three.js галактика; getGalaxyServices() возвращает переведённые данные
  HeroKPIs/             ← 5 KPI-карточек с count-up, фиксированная высота 90px
  ActivityFeed/         ← скролл-лог событий; иконки: ✓published ✗banned !error ▶job_started ●job_complete ■job_stopped ↑service_online ↓service_offline
  PlanetPanel/          ← панель при клике на планету
  Layout/               ← sidebar навигация
  MetricChart/          ← Canvas 2D: line/area/bar/donut/gauge/sparkline
pages/
  Galaxy/               ← / (без AuthGuard) — 3D галактика + HeroKPIs + ActivityFeed
  Phones, PhoneDetail, Accounts, AccountDetail, Generate, Queue, Videos, Analytics, Login
  Clients ← таблица клиентов + inline форма создания (name, email, plan: basic/pro/enterprise, phones_limit); только super_admin
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

Реализованные интерфейсы в `packages/shared/src/index.ts`:
- `Phone` — телефон фермы (phone_id, serial, status, warmup_day, health_score, accounts[])
- `Account` — TikTok аккаунт (account_id, username, niche, content_sources[], stats)
- `QueueTask` — задача публикации (task_id, account_id, file_url, status, scheduled_at)
- `FarmEvent` — WS событие (event: published|banned|error|failed|heartbeat|job_complete|job_started|job_stopped|service_online|service_offline)
- `ActivityEvent.type` — те же значения плюс `info`
- `VideoFile` — видео в MinIO (filename, url, thumbnail_url, status)
- `GenerationJob` — задание генерации (job_id, service, progress, status)

---

## Команды

```bash
npm run dev          # web + api одновременно
npm run dev:web      # только фронтенд
npm run dev:api      # только бэкенд
npm run check        # biome lint + format check
npm run check:fix    # biome автоисправление
npm run changelog    # сгенерировать CHANGELOG.md
docker compose up    # вся инфраструктура
```

---

## Стиль кода

- TypeScript строгий — `strict: true`
- CSS Modules для стилей компонентов
- Zustand для всего состояния (не React state для глобальных данных)
- Компоненты в отдельных папках с `index.ts` реэкспортом
- Адаптеры в `apps/api/src/mcp/` — следовать паттерну `cloudflare.adapter.ts`
- Линтер + форматтер: **Biome** (`biome.json`) — заменяет ESLint и Prettier
  - `unsafeParameterDecoratorsEnabled: true` — для NestJS `@Query`/`@Body`/`@Param`
  - `.claude-flow`, `.claude`, `galaxy` исключены из проверки (`files.includes` excludes)
- Git-хуки: **Lefthook** (`lefthook.yml`) — pre-commit запускает biome + tsc
  - `--diagnostic-level=error` — хук падает только на errors, warnings не блокируют коммит
- **Все запросы к API** — использовать `apiFetch` из `apps/web/src/lib/api.ts`, **не** raw `fetch` — иначе JWT не передаётся → 401; после ответа проверять `Array.isArray(data)` перед setState если ожидается массив (иначе 401-объект крашит `.map()`)
- **useEffect с локальными функциями** — не включать их в deps array (новая ссылка каждый рендер → бесконечный цикл). Пример: `useEffect(() => { localFn(); }, [])` — только `[]`
- **Vite proxy (vite.config.ts)**: `/api` → `http://localhost:3001`; `/socket.io` → `http://localhost:3001` с `ws: true` (socket.io handshake идёт на `/socket.io/...`, не на `/ws`)

## i18n

- 4 языка: `ru` (default), `en`, `zh`, `es`
- Хук `useT()` — в React-компонентах
- Функция `getT()` — в не-React коде (engine.ts и др.)
- `LOCALE_MAP` — для форматирования дат по локали
- Все ключи должны присутствовать в **всех 4 локалях** (TypeScript constraint `satisfies`)
- Galaxy `farm` планета: название всегда "Device Fleet" (захардкожено, не через i18n)

## MinIO / Videos

- `VideosService` использует S3 XML API (`GET /{bucket}/?list-type=2`) без SDK
- Переменные: `MINIO_URL` (default: `http://localhost:9000`), `MINIO_BUCKET` (default: `atome-videos`)
- Работает только с **публичными** бакетами — для приватных нужна AWS Signature v4
