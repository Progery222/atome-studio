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
- `apps/web/Dockerfile` — multi-stage образ для фронтенда. Билдит Vite → nginx. `$PORT` и `$API_INTERNAL_URL` подставляются через `envsubst` в `nginx.conf` при старте.
- `.railwayignore` — исключает SportZavod/, content-zavod/, galaxy/, files/, node_modules/ из Railway upload.
- `.github/workflows/deploy-api.yml` — деплой API при пуше в `apps/api/**` или `packages/shared/**`. Использует service ID `1ad14f0e-dd02-44ec-ac73-7418751678ab`.
- `.github/workflows/deploy-web.yml` — деплой фронтенда при пуше в `apps/web/**` или `packages/shared/**`. Перезаписывает `railway.toml` на web Dockerfile перед деплоем. Использует service ID `c4612d57-2a39-471d-8a76-9de9bec3d693`.

---

## Деплой (Railway / production)

| Сервис | Railway имя | URL | Dockerfile |
|--------|------------|-----|-----------|
| Dashboard API | `atome-studio` | `atome-studio-production.up.railway.app` | `apps/api/Dockerfile` |
| Dashboard Web | `zooming-delight` | `zooming-delight-production-9bdf.up.railway.app` | `apps/web/Dockerfile` |
| SportZavod | `SportZavod` | `sportzavod-production.up.railway.app` | репо `Progery222/SportZavod` |
| content-zavod | `content-zavod` | — | репо `Progery222/content-zavod` |
| MinIO | `minio` | `minio-production-553a.up.railway.app` | Railway template |

**Ключевые переменные API (`atome-studio`):**
- `SPORTZAVOD_URL=http://sportzavod.railway.internal:8000`
- `CONTENTZAVOD_URL=http://content-zavod.railway.internal:8002`
- `MINIO_URL=http://minio.railway.internal:9000`, `MINIO_BUCKET=atome-videos`
- `JWT_SECRET` — задан в Railway Variables
- `DATABASE_URL` — Neon Postgres connection string (pooler URL с `sslmode=require`)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — начальный admin (fallback: `admin@atome.studio` / `admin123`)

**Ключевые переменные Web (`zooming-delight`):**
- `API_INTERNAL_URL=http://atome-studio.railway.internal:3001`
- `PORT=80`

**GitHub Actions:** требуют секрет `RAILWAY_TOKEN` в репо `Progery222/atome-studio`.

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
services/               ← ServicesService (polling каждые 30с), ServicesController, GET /api/services/kpis; videos_today из GenerationJobLog (Postgres); cost_per_video = AVG(costUsd) WHERE costUsd > 0 из GenerationJobLog (реальная стоимость из content-zavod, не env)
auth/                   ← JWT авторизация; пользователи в Neon Postgres через Prisma; роли: admin/editor/viewer
prisma/                 ← PrismaService + PrismaModule (global); schema в apps/api/prisma/schema.prisma; таблицы: User (auth), GenerationJobLog (jobId, service, durationSec, videosCount, costUsd, status, createdAt)
generation/             ← POST /api/generate, POST /api/generate/auto, GET /api/jobs/:id, GET /api/jobs/stats, POST /api/jobs/stop-all; эмитит job_started/job_complete/job_stopped через EventsGateway; внутренний поллинг каждые 8с; jobServiceMap → роутинг job_id к нужному сервису; jobStartTimes → Map<jobId, timestamp> для точного подсчёта durationSec; fallback-цепочка: jobStartTimes → job.started_at (SportZavod возвращает created_at = started_at) → Date.now(); при завершении сохраняет в GenerationJobLog включая costUsd из ответа сервиса; getStats() → AVG(durationSec) из БД per service
events/                 ← EventsGateway (Socket.io WS мост к orchestrator); экспортируется из EventsModule; метод emit(FarmEvent) для внутреннего использования
videos/                 ← VideosService (S3 XML API к MinIO), GET /api/videos
clients/                ← CRUD клиентов (super_admin only)
metrics/                ← MetricsService, GET /api/metrics/history — читает из GenerationJobLog (Postgres), группирует по дням/часам; возвращает videos + jobs_completed из реальных данных; revenue/cost/accounts_active = 0 (нет источника)
```

### Frontend (`apps/web/src/`)
```
stores/
  services.ts           ← главный store (Service[], metrics, tooltip); fetchServices пушит ActivityEvent при смене статуса сервиса
  farm.ts               ← Phone[], Account[], QueueTask[], WS events; sportzavodThemes: SportZavodTheme[]; fetchSportzavodThemes(); stopAllJobs(); fetchJobs пушит synthetic ActivityEvent (job progress/done/error) когда wsConnected=false; при пустом ответе API activeJobs=[] (не mock — mock только при сетевой ошибке И пустом списке)
  metrics.ts            ← kpis: HeroKPI, fetchKPIs(); demoMode toggle
  analyticsExtra.ts     ← Performance Analytics store: accountStats, topVideos, trafficSources, conversionHistory, kpis (total_views/avg_views/link_clicks/conversion_rate), generationStats: GenerationStats; fetchGenerationStats() → GET /api/jobs/stats; generateDemo(period) для demo mode
  activity.ts           ← кольцевой буфер ActivityEvent (max 50)
  auth.ts               ← useAuthStore — JWT token, user, login/logout
  lang.ts               ← useLangStore — текущий язык (ru/en/zh/es)
i18n/
  index.ts              ← ~300 ключей, 4 локали; useT() хук; getT() для не-React кода; LOCALE_MAP; analytics_gen_speed/analytics_gen_jobs/analytics_gen_no_data — ключи для блока Generation Speed на Analytics
components/
  AtomicCanvas/         ← Three.js галактика; getGalaxyServices() возвращает переведённые данные
  HeroKPIs/             ← 5 KPI-карточек с count-up, фиксированная высота 90px; адаптивный размер: 82px @<1200px, 72px @<900px (clamp font-size)
  ActivityFeed/         ← скролл-лог событий; иконки: ✓published ✗banned !error ▶job_started ●job_complete ■job_stopped ↑service_online ↓service_offline
  PlanetPanel/          ← панель при клике на планету
  Layout/               ← sidebar навигация; 220px → 180px @<1100px; hamburger + overlay на <768px (sidebarOpen state)
  MetricChart/          ← Canvas 2D: line/area/bar/donut/gauge/sparkline
  Leaderboard/          ← ранжированный список (rank, label, bar, value); props: items, formatValue, color, max
pages/
  Galaxy/               ← / (без AuthGuard) — 3D галактика + HeroKPIs + ActivityFeed; activityFeed скрывается на <1100px
  Phones, PhoneDetail, Accounts (scroll wrapper), AccountDetail, Generate, Queue (scroll wrapper), Videos, Analytics, Login — все страницы имеют адаптивные breakpoints: 768px (mobile), 1100px (tablet)
  Generate ← правая колонка (ЗАДАЧИ): компактная карточка джоба показывает статус текстом (gen_status_* ключи) с цветом jColor, рядом с job_id; `getJobDisplayPercent()` — если `progress=0` и `total>0` во время **running**, считает процент по времени (~1%/3с, cap 95%) на основе `job.started_at`; для **stopping/stopped/error** — только реальный progress/total (без времени); indeterminate только когда `total=0` и статус `running`; ProgressScreen — полный просмотр джоба при клике: SVG-кольцо (`ProgressRing`), процент в центре, статус-строка, стейдж = последняя строка `latest_log` (HTML-теги вырезаются, i18n: `gen_stage_label`/`gen_stage_running`), при ошибке — `gen_error_label` + `current_message`, мета-данные (vpa, scope, cost)
  Clients ← таблица клиентов + inline форма создания (name, email, plan: basic/pro/enterprise, phones_limit); только super_admin
  Analytics ← 2 секции: основные KPI + графики; Performance секция с views/clicks/traffic/leaderboards (данные из analyticsExtra, demo-aware)
  Videos ← toolbar в header: сортировка (date_new/date_old/account), фильтры (service/account/status), текстовый поиск (title+caption+description+hashtags+account_id), toggle группировки по дате (groupByDate); subtitle показывает N/total; все фильтры — локальный state + useMemo pipeline на фронте
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
GET  /api/jobs                        → список jobs
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
- `GenerationJob` — задание генерации (job_id, service, progress, status: running|done|error|stopped|**stopping**, is_auto, results[], cost_usd?: number)
- `GenerationServiceStats` / `GenerationStats` — статистика генерации (avg_sec, count, last_updated); `Record<string, GenerationServiceStats>`
- `SportZavodTheme` — тема генерации SportZavod (theme_key, theme_name, count)
- `GenerationScope` — `"all" | "theme" | "account" | "query"`
- `AccountAnalytics` — аналитика аккаунта (account_id, username, platform, total_views, total_likes, link_clicks, avg_views_per_video)
- `VideoAnalytics` — аналитика видео (video_id, title, account_id, views, likes, link_clicks, completion_rate, published_at)
- `TrafficSource` — источник трафика (source, views, percentage)
- `ConversionPoint` — точка воронки (ts, views, link_clicks, conversion_rate)

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

# Prisma (запускать из apps/api/)
npx prisma migrate dev --name <name>   # создать миграцию + применить
npx prisma db seed                      # засеять admin (идемпотентно)
npx prisma generate                     # регенерировать клиент после изменений схемы
npx prisma studio                       # GUI для просмотра БД
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

## Стабильность / Railway

- `ServicesService.sync()` обёрнут в try-catch — ошибка адаптера не убивает cron job
- `EventsGateway.connectWebSocket()` закрывает старый WS перед созданием нового (предотвращает утечку)
- `VideosService.getVideos()` — 1 retry через 2с при ошибке сети к MinIO
- `nginx.conf`: `resolver 127.0.0.11 8.8.8.8 valid=10s ipv6=off` — fallback DNS на Railway
- `GET /health` → `{ status: "ok", uptime: N }` — без JWT, без `/api` префикса; используется Railway для liveness check
- Карточки видео: `caption` для content-zavod собирается на бэкенде (`title + description + hashtags`); фронт использует `video.caption || video.description`

**WebSocket стабильность (Railway):**
- `nginx.conf` `/socket.io/`: `proxy_read_timeout 3600s` + `proxy_send_timeout 3600s` — иначе nginx убивает WS через 60с (дефолт)
- `EventsGateway`: `pingInterval: 25000, pingTimeout: 20000` — Socket.io пингует каждые 25с, держит соединение живым через Railway edge (таймаут 300с); при разрыве WS к оркестратору — fallback на polling `GET /api/status` каждые 5с; переподключение к WS оркестратора пробует каждые 10с
- `farm.ts` `connectWs()`: `reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000..10000` — клиент переподключается автоматически при разрыве

## MinIO / Videos

- `VideosService` использует S3 XML API (`GET /{bucket}/?list-type=2`) без SDK
- Переменные: `MINIO_URL` (default: `http://localhost:9000`), `MINIO_BUCKET` (default: `atome-videos`)
- Работает только с **публичными** бакетами — требует политика `s3:ListBucket` + `s3:GetObject`
- **Все сервисы должны писать в один бакет `atome-videos`** — иначе Videos страница пустая
- `docker-compose.yml` включает `minio-init` контейнер — автоматически создаёт бакет и ставит публичную политику при `docker compose up`
- SportZavod и content-zavod при первой загрузке файла сами создают бакет с нужной политикой (list+read)
- Конфигурация в `apps/api/.env`: `MINIO_URL`, `MINIO_BUCKET`
- В `.env` каждого завода: `MINIO_BUCKET=atome-videos`, `MINIO_ACCESS_KEY=minioadmin`, `MINIO_SECRET_KEY=minioadmin`

**Структура путей в MinIO:**
```
sportzavod/{YYYY-MM-DD}/{account_folder}/{post_slug}/{filename}.mp4   ← SportZavod
content-zavod/{YYYY-MM-DD}/{topic_slug}/{title_slug}.mp4              ← content-zavod
```
- `account_folder` = `{id}_{instagram_user}` из Google Sheets
- `topic_slug` = тема запроса (одинаково для Telegram-бота и API дашборда)

## Telegram бот в заводах

Оба сервиса поддерживают запуск с ботом или без:

| Переменная | SportZavod | content-zavod |
|---|---|---|
| Включить бота | `BOT_ENABLED=true` (дефолт) | `BOT_ENABLED=true` (дефолт) |
| Только REST API | `BOT_ENABLED=false` | `BOT_ENABLED=false` |
| Токен бота | `TELEGRAM_BOT_TOKEN` | `TG_BOT_TOKEN` |

- При `BOT_ENABLED=false` токен не обязателен — сервис стартует только как REST API для дашборда

## Generation / Jobs

- `generation.service.ts:normalizeStatus()` нормализует статусы обоих сервисов:
  - content-zavod `waiting_approval` → `running` (ждёт апрув в Telegram, ещё не завершён)
  - content-zavod `not_relevant` → `stopped` (тема нерелевантна, пайплайн прерван)
  - `pending` → `running` (только что стартовал)
- `contentzavod.adapter.ts` считает активными задачи со статусом `running` **или** `pending`
- `farm.service.ts:reloadAccounts()` читает `data.loaded ?? data.reloaded` из SportZavod (SportZavod возвращает `{ loaded: N }`, не `reloaded`)
- **SportZavod не имеет `GET /api/jobs/:id`** — `generation.service.ts:getJobFromService()` делает fallback на `GET /api/jobs` + поиск по `job_id` в списке
- **`farm.ts:startGeneration()`** — обязательно передаёт `service` в теле POST `/api/generate` (без него запрос уходит в content-zavod по умолчанию)
- **`GenerationService.generateAuto()`** — POST `/api/generate/auto` к SportZavod; `is_auto: true` в джобе; эмитит `job_started` с флагом `is_auto`
- **`GenerationService.stopAllJobs()`** — POST `/api/jobs/stop-all` к SportZavod; возвращает `{ stopped_count }`
- **`GenerationService.getStats()`** — возвращает `GenerationStats` из Postgres (avg duration per service, накапливается постоянно, не сбрасывается при рестарте)
- **`GenerationJob.cost_usd`** — реальная стоимость пайплайна из сервиса-генератора; content-zavod считает через `CostTracker` (Brave Search + LLM токены + Kie.ai $0.30); SportZavod возвращает 0 (нет cloud API); сохраняется в `GenerationJobLog.costUsd`; KPI "Cost/Video" = AVG(costUsd) WHERE costUsd > 0 — не env переменная, а реальные данные
- **`normalizeStatus()`** также нормализует: `queued`/`success`/`completed` → `done`; `stopping` сохраняется as-is
- **`GenerationJob.percent`** — вычисляется только из `progress/total` (`resolvePercent`); `raw.percent` от SportZavod игнорируется (SportZavod отдаёт `percent: 99` при входе в rendering-фазу — это маркер этапа, не реальный прогресс)
- **`pollJobUntilDone()` stopping timeout** — если джоб завис в `stopping`: после ~2 мин (40 попыток × 3с) автоматически ретраит POST `/api/jobs/:id/stop`; после ~10 мин (200 попыток) принудительно записывает `job_stopped` событие и завершает поллинг (`force-stopped after timeout`)
- **`farm.service.ts:getSportzavodAccounts()`** — маппит `has_avatar: bool` → `heygen_avatar_id: "sz-{id}" | undefined`; без этого все аккаунты считаются "без аватара" и `readyAccounts` пуст
- **`SportZavod/agent/sheets_manager.py:_FILL_DOWN_COLS`** — включает `"HeyGen Avatar ID"` и `"HeyGen Voice ID"`, чтобы объединённые ячейки в Google Sheet заполнялись вниз по всем аккаунтам группы; без этого `has_avatar` возвращает `false` для аккаунтов кроме первого в группе
