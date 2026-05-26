# Atome Studio — Codex Instructions

## Контекст проекта

TikTok content farm dashboard. Управляет фермой телефонов, генерацией видео (SportZavod + content-zavod), нарезкой видео на шортсы (StreamCut) и публикацией через Orchestrator.

**Монорепо:**
- `apps/web` — React 18 + TypeScript + Three.js + Zustand (порт 5173)
- `apps/api` — NestJS + TypeScript (порт 3001)
- `apps/StreamCut` — FastAPI + Celery + Redis (порт 8003) — AI-нарезка видео на шортсы
- `packages/shared` — общие TypeScript типы

---

## Standalone файлы

- `tools/atomic-monitor.html` — автономный дашборд мониторинга (без сборки, открывается в браузере напрямую). Не часть монорепо, не трогать без нужды. 5 орбитальных колец (CF, PostHog, Postman, Cyan, Gold) с 3-слойным glow (широкое свечение + ядро + белый core) и спарклами на передних сегментах; центральная планета: белое горячее ядро, анимированные световые лучи, экваториальный пылевой диск (60 частиц), энергетическая турбулентность, экваториальные полосы; боковая панель метрик.
- `scripts/deploy.sh` — локальный deploy helper: подтягивает `main`, пересобирает и перезапускает `api`/`web` из корневого `docker-compose.yml`.
- `docs/architecture.md` — короткие архитектурные границы проекта.
- `docs/adr/` — короткие ADR для важных решений.
- `apps/api/Dockerfile` — multi-stage Docker образ для деплоя API. Build context — корень монорепо (нужен для `packages/shared`). Билдит shared → api, запускает `node dist/main` на порту 3001.
- `apps/web/Dockerfile` — multi-stage образ для фронтенда. Билдит Vite → nginx. `$PORT` и `$API_INTERNAL_URL` подставляются через `envsubst` в `nginx.conf` при старте.
- `.railwayignore` — исключает SportZavod/, content-zavod/, apps/StreamCut/, galaxy/, files/, node_modules/ из Railway upload.
- `.github/workflows/deploy-api.yml` — деплой API при пуше в `apps/api/**` или `packages/shared/**`. Использует service ID `1ad14f0e-dd02-44ec-ac73-7418751678ab`.
- `.github/workflows/deploy-web.yml` — деплой фронтенда при пуше в `apps/web/**` или `packages/shared/**`. Перезаписывает `railway.toml` на web Dockerfile перед деплоем. Использует service ID `c4612d57-2a39-471d-8a76-9de9bec3d693`.
- StreamCut деплоится из своего репо `Progery222/StreamCut` (аналогично SportZavod/content-zavod). CI/CD настраивается в том репо.

---

## Деплой (Railway / production)

| Сервис | Railway имя | URL | Dockerfile |
|--------|------------|-----|-----------|
| Dashboard API | `atome-studio` | `atome-studio-production.up.railway.app` | `apps/api/Dockerfile` |
| Dashboard Web | `zooming-delight` | `zooming-delight-production-9bdf.up.railway.app` | `apps/web/Dockerfile` |
| SportZavod | `SportZavod` | `sportzavod-production.up.railway.app` | репо `Progery222/SportZavod` |
| content-zavod | `content-zavod` | — | репо `Progery222/content-zavod` |
| MinIO | `minio` | `minio-production-553a.up.railway.app` | Railway template |
| StreamCut Backend | TBD | — | `apps/StreamCut/backend/Dockerfile` |
| StreamCut Worker | TBD | — | `apps/StreamCut/backend/Dockerfile` (command: celery) |
| StreamCut Redis | TBD | — | Railway Redis plugin |

**Ключевые переменные API (`atome-studio`):**
- `SPORTZAVOD_URL=http://sportzavod.railway.internal:8000`
- `CONTENTZAVOD_URL=http://content-zavod.railway.internal:8002`
- `STREAMCUT_URL=http://streamcut-backend.railway.internal:8000`
- `STREAMCUT_SERVICE_PASSWORD` — пароль сервис-аккаунта для авторизации в StreamCut
- `MINIO_URL=http://minio.railway.internal:9000`, `MINIO_BUCKET=atome-videos`
- `JWT_SECRET` — задан в Railway Variables
- `DATABASE_URL` — Neon Postgres connection string (pooler URL с `sslmode=require`)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — начальный admin (fallback: `admin@atome.studio` / `admin123`)

**Ключевые переменные Web (`zooming-delight`):**
- `API_INTERNAL_URL=http://atome-studio.railway.internal:3001`
- `PORT=80`

**GitHub Actions:** требуют секрет `RAILWAY_TOKEN` в репо `Progery222/atome-studio`.

---

## Правила работы

1. **Перед началом** — проверь актуальное состояние кода и `git status`
2. **Реализуй один логический шаг за раз**
3. **Не переходи к следующей фазе**, пока текущая не проверена
4. **При изменении типов** — добавляй в `packages/shared/src/index.ts`, не дублируй в app-пакетах

---

## Архитектура

### Backend (`apps/api/src/`)
```
mcp/                    ← адаптеры к внешним сервисам (cloudflare, postman, posthog, sportzavod, farm, contentzavod, streamcut)
services/               ← ServicesService (polling каждые 30с), ServicesController, GET /api/services/kpis; videos_today из GenerationJobLog (Postgres); cost_per_video = AVG(costUsd) WHERE costUsd > 0 из GenerationJobLog (реальная стоимость из content-zavod, не env)
auth/                   ← JWT авторизация; пользователи в Neon Postgres через Prisma; роли: admin/editor/viewer
prisma/                 ← PrismaService + PrismaModule (global); schema в apps/api/prisma/schema.prisma; таблицы: User (auth), GenerationJobLog (jobId, service, durationSec, videosCount, costUsd, status, createdAt)
generation/             ← POST /api/generate, POST /api/generate/auto, GET /api/jobs/:id, GET /api/jobs/stats, GET /api/jobs/cost-stats, POST /api/jobs/stop-all; эмитит job_started/job_complete/job_stopped через EventsGateway; внутренний поллинг каждые 8с; jobServiceMap → роутинг job_id к нужному сервису; jobStartTimes → Map<jobId, timestamp> для точного подсчёта durationSec; fallback-цепочка: jobStartTimes → job.started_at (SportZavod возвращает created_at = started_at) → Date.now(); при завершении сохраняет в GenerationJobLog включая costUsd из ответа сервиса; getStats() → AVG(durationSec) из БД per service; getCostStats() → GenerationCostReport { services: Record<service, {total_usd, avg_usd_per_video, videos_count, jobs_count}>, total: same } из БД groupBy service WHERE costUsd > 0
events/                 ← EventsGateway (Socket.io WS мост к orchestrator); экспортируется из EventsModule; метод emit(FarmEvent) для внутреннего использования
videos/                 ← VideosService (S3 XML API к MinIO), GET /api/videos
clients/                ← CRUD клиентов (super_admin only)
metrics/                ← MetricsService, GET /api/metrics/history — читает из GenerationJobLog (Postgres), группирует по дням/часам; возвращает videos + jobs_completed из реальных данных; revenue/cost/accounts_active = 0 (нет источника)
streamcut/              ← StreamCutModule — прокси к StreamCut (FastAPI); сервис-аккаунт авторизация; endpoints: GET /api/streamcut/video-info, POST /api/streamcut/jobs, GET /api/streamcut/jobs, GET /api/streamcut/jobs/:id, DELETE /api/streamcut/jobs/:id, GET /api/streamcut/footage-categories; поллит джобы каждые 5с и эмитит FarmEvent через EventsGateway
autonomy/               ← AutonomyModule — прокси к Orchestrator (FastAPI :8001); без авторизации (orchestrator не требует токена); envelope unwrap через getList() — orchestrator отдаёт {sessions:[]} / {goals:[]} / {events:[]} / {recoveries:[]} / {global_goals:[]}; endpoints: GET|POST /api/autonomy/sessions[/:serial[/pause|/resume|/terminate]], GET /api/autonomy/actions/:serial/recent, GET /api/autonomy/observations/:serial/recent, GET /api/autonomy/anomaly/events, GET /api/autonomy/recoveries/recent, GET|POST /api/goals, GET /api/goals/:serial/current, GET|POST /api/global_goals; URL из process.env.AUTONOMY_URL (не ORCHESTRATOR_URL — тот указывает на farm-relay :8800)
```

### Frontend (`apps/web/src/`)
```
stores/
  services.ts           ← главный store (Service[], metrics, tooltip); fetchServices пушит ActivityEvent при смене статуса сервиса
  farm.ts               ← Phone[], Account[], QueueTask[], WS events; sportzavodThemes: SportZavodTheme[]; fetchSportzavodThemes(); stopAllJobs(); fetchJobs пушит synthetic ActivityEvent (job progress/done/error) когда wsConnected=false; при пустом ответе API activeJobs=[] (не mock — mock только при сетевой ошибке И пустом списке)
  metrics.ts            ← kpis: HeroKPI, fetchKPIs(); demoMode toggle
  streamcut.ts          ← StreamCut store: jobs, videoInfo, footageCategories; CRUD через apiFetch к /api/streamcut/*; поллинг каждые 5с
  autonomy.ts           ← Phone Autonomy store: sessionsBySerial (Record<serial, AutonomySessionDetail>), sessionsList, phoneGoals, globalGoals, anomalies, recoveries; CRUD через apiFetch к /api/autonomy/*, /api/goals, /api/global_goals; fetchAllSessions гидратирует sessionsBySerial (session без last_* полей — detail фетчится отдельно в AutonomyPage)
  analyticsExtra.ts     ← Performance Analytics store: accountStats, topVideos, trafficSources, conversionHistory, kpis (total_views/avg_views/link_clicks/conversion_rate), generationStats: GenerationStats, costReport: GenerationCostReport|null; fetchGenerationStats() → GET /api/jobs/stats; fetchCostStats() → GET /api/jobs/cost-stats; generateDemo(period) включает demo costReport; оба fetch вызываются каждые 30с
  activity.ts           ← кольцевой буфер ActivityEvent (max 50)
  auth.ts               ← useAuthStore — JWT token, user, login/logout
  lang.ts               ← useLangStore — текущий язык (ru/en/zh/es)
i18n/
  index.ts              ← ~300 ключей, 4 локали; useT() хук; getT() для не-React кода; LOCALE_MAP; analytics_gen_speed/analytics_gen_jobs/analytics_gen_no_data — ключи для блока Generation Speed на Analytics
hooks/
  useAutonomyPolling.ts ← useAutonomyPolling(intervalMs=3000, activeOnly=false) — поллит fetchAllSessions; используется в PhoneGridPage и AutonomyPage
components/
  AtomicCanvas/         ← Three.js галактика; getGalaxyServices() возвращает переведённые данные
  AutonomyBadge/        ← StateBadge / SeverityBadge / GoalKindBadge / SeverityDot — переиспользуются на карточках PhoneGrid и в таблицах Autonomy/Anomalies; цвета state: observing=#60a5fa, planning=#a78bfa, acting=#22c55e, validating=#00d2ff, recovering/paused=#fbbf24, idle/terminated=#6b7280; severity: low=#6b7280, medium=#fbbf24, high=#ff6b6b, critical=#ef4444
  HeroKPIs/             ← 5 KPI-карточек с count-up, фиксированная высота 90px; адаптивный размер: 82px @<1200px, 72px @<900px (clamp font-size)
  ActivityFeed/         ← скролл-лог событий; иконки: ✓published ✗banned !error ▶job_started ●job_complete ■job_stopped ↑service_online ↓service_offline
  PlanetPanel/          ← панель при клике на планету
  Layout/               ← sidebar навигация; 220px → 180px @<1100px; hamburger + overlay на <768px (sidebarOpen state)
  MetricChart/          ← Canvas 2D: line/area/bar/donut/gauge/sparkline
  Leaderboard/          ← ранжированный список (rank, label, bar, value); props: items, formatValue, color, max
pages/
  Galaxy/               ← / (без AuthGuard) — 3D галактика + HeroKPIs + ActivityFeed; activityFeed скрывается на <1100px
  Phones, PhoneDetail, Accounts (scroll wrapper), AccountDetail, Generate, Queue (scroll wrapper), Videos, Analytics, Login — все страницы имеют адаптивные breakpoints: 768px (mobile), 1100px (tablet)
  Generate ← правая колонка (ЗАДАЧИ): компактная карточка джоба показывает статус текстом (gen_status_* ключи) с цветом jColor, рядом с job_id; `getJobDisplayPercent()` — если `progress=0` и `total>0` во время **running**, считает процент по времени (~1%/3с, cap 95%) на основе `job.started_at`; для **stopping/stopped/error** — только реальный progress/total (без времени); indeterminate только когда `total=0` и статус `running`; `formatElapsed(started_at, nowMs)` — показывает elapsed время **только для running/stopping** статусов; для done/stopped/error время не показывается; ProgressScreen — полный просмотр джоба при клике: SVG-кольцо (`ProgressRing`), процент в центре, статус-строка, стейдж = последняя строка `latest_log` (HTML-теги вырезаются, i18n: `gen_stage_label`/`gen_stage_running`), при ошибке — `gen_error_label` + `current_message`, мета-данные (vpa, scope, cost)
  Clients ← таблица клиентов + inline форма создания (name, email, plan: basic/pro/enterprise, phones_limit); только super_admin
  Analytics ← 3 секции: основные KPI + графики; Performance секция с views/clicks/traffic/leaderboards; **Cost Analytics** секция — KPI (total_spent/per-service/avg_per_video) + donut (cost by service) + bar (avg $/video by service); данные из analyticsExtra.costReport, demo-aware
  Videos ← toolbar в header: сортировка (date_new/date_old/account), фильтры (service/account/status), текстовый поиск (title+caption+description+hashtags+account_id), toggle группировки по дате (groupByDate); subtitle показывает N/total; все фильтры — локальный state + useMemo pipeline на фронте
  StreamCut ← /streamcut — two-column layout: левая — ввод URL + опции (язык, max_shorts, caption_style, reframe_mode, music) + кнопка; правая — список джобов с прогрессом по шагам (download→transcribe→analyze→cut→render) + галерея шортсов при завершении
  PhoneGrid ← /phone-grid — сетка карточек с WebCodecs H264 стримом через `<PhoneStream>` (WS /relay/ws/:serial → VideoDecoder); overlay снизу (serial + status), overlay сверху (StateBadge + SeverityDot если < 5 мин); клик — focus overlay с увеличенным стримом; автономные данные из useAutonomyStore.sessionsBySerial, обновляются через useAutonomyPolling(3000)
  Autonomy ← /autonomy — two-column: левая — таблица всех сессий (serial, state badge, last action ✓/✗, last anomaly severity); правая — detail выбранной сессии: StateBadge + pause_reason, кнопки Pause/Resume/Terminate (disabled зависит от state), секция "Last 50 actions" (таблица ts/type/result/duration), секция "Last 20 observations" (ts + screen_summary); поллит fetchSession + fetchActions + fetchObservations каждые 3с
  Goals ← /goals — tabs Phone goals / Global goals; Phone: форма (серийник select из useFarmStore.phones, kind dropdown, priority 0-10) + фильтр-чипы по status + таблица; Global: форма (kind + PhoneSelector поля serials/shard/count/status) + таблица; поллинг 10с
  Anomalies ← /anomalies — filter bar (severity multi-chip, signature_id search, time range 1h/24h/7d — передаётся в fetchAnomalies как since=ISO); основная таблица аномалий + секция "Recent recoveries"; поллинг 10с
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
| StreamCut Backend (FastAPI) | 8003 (mapped from 8000) |
| StreamCut Redis | 6379 |

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

### Dashboard API → Orchestrator (autonomy) `AUTONOMY_URL=:8001`
Отдельная env-переменная `AUTONOMY_URL` (дефолт `http://localhost:8001`). ORCHESTRATOR_URL=:8800 указывает на farm-relay, не путать. Все list-эндпоинты возвращают envelope-объект — `AutonomyService.getList()` распаковывает:
```
GET  /api/autonomy/sessions            → {sessions: PhoneAutonomySession[]}
GET  /api/autonomy/sessions/:serial    → AutonomySessionDetail {session, last_observation?, last_action?, last_anomaly?}
POST /api/autonomy/sessions/:serial/pause
POST /api/autonomy/sessions/:serial/resume
POST /api/autonomy/sessions/:serial/terminate
GET  /api/autonomy/actions/:serial/recent?limit=50      → {actions: PhoneActionExecution[]}
GET  /api/autonomy/observations/:serial/recent?limit=20 → {observations: PhoneObservation[]}
GET  /api/autonomy/anomaly/events?severity=&signature_id=&since= → {events: PhoneAnomalyEvent[]}
GET  /api/autonomy/recoveries/recent   → {recoveries: PhoneRecoveryAttempt[]}
GET  /api/goals?status=&serial=        → {goals: PhoneGoal[]}
GET  /api/goals/:serial/current        → PhoneGoal
POST /api/goals                        → {serial, kind, params?, priority?} → PhoneGoal
GET  /api/global_goals                 → {global_goals: GlobalGoal[]}
POST /api/global_goals                 → {kind, phone_selector: {serials?|shard?|count?|status?}, params?} → GlobalGoal
```

Human override: существующий POST /api/input/:serial (на farm-relay) — тап/свайп по телефону в PhoneGridPage автоматически ставит autonomy-сессию в `paused` с `pause_reason=human` (обрабатывается оркестратором, фронту ничего не надо делать — после следующего polling session придёт с новым state).

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

### Dashboard API → StreamCut `:8003`
```
GET  /health                          → статус
GET  /jobs/active-count               → { count } (без авторизации, для MCP health check)
POST /auth/register                   → регистрация сервис-аккаунта
POST /auth/login                      → OAuth2PasswordRequestForm → { access_token }
GET  /video-info?url=                 → { title, duration, thumbnail, uploader }
POST /jobs                            → создать задачу нарезки (требует JWT)
GET  /jobs                            → список задач текущего пользователя
GET  /jobs/:id                        → статус задачи с шагами и шортсами
DELETE /jobs/:id                      → удалить задачу
GET  /footage/categories              → категории B-roll футажа
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
- `GenerationCostServiceStats` / `GenerationCostReport` — статистика затрат: `{ total_usd, avg_usd_per_video, videos_count, jobs_count }`; `GenerationCostReport = { services: Record<string, GenerationCostServiceStats>, total: GenerationCostServiceStats }`
- `SportZavodTheme` — тема генерации SportZavod (theme_key, theme_name, count)
- `GenerationScope` — `"all" | "theme" | "account" | "query"`
- `AccountAnalytics` — аналитика аккаунта (account_id, username, platform, total_views, total_likes, link_clicks, avg_views_per_video)
- `VideoAnalytics` — аналитика видео (video_id, title, account_id, views, likes, link_clicks, completion_rate, published_at)
- `TrafficSource` — источник трафика (source, views, percentage)
- `ConversionPoint` — точка воронки (ts, views, link_clicks, conversion_rate)
- `StreamCutJobStatus` — статус задачи StreamCut (pending|downloading|transcribing|analyzing|cutting|rendering|publishing|done|error)
- `StreamCutStep` — шаг пайплайна (id, label, status, detail)
- `StreamCutShort` — готовый шортс (filename, url, title, duration, score)
- `StreamCutJob` — задача нарезки (job_id, status, message, progress, steps[], shorts[], error, source_url)
- `StreamCutVideoInfo` — метаданные видео (title, duration, thumbnail, uploader)
- `AutonomyState` — `"idle" | "observing" | "planning" | "acting" | "validating" | "recovering" | "paused" | "terminated"`
- `AutonomyPauseReason` — `"human" | "anomaly" | "manual" | null`
- `GoalKind` — `"browse_fyp" | "warmup_day_1" | "publish_video" | "recover_from_ban"`
- `GoalStatus` — `"pending" | "active" | "completed" | "failed" | "cancelled"`
- `AnomalySeverity` — `"low" | "medium" | "high" | "critical"`
- `PhoneAutonomySession` — состояние автономии телефона (serial, state, active_goal_id, pause_reason, started_at, updated_at)
- `PhoneObservation` — снимок экрана/состояния (id, serial, ts, screen_summary?, raw?)
- `PhoneActionExecution` — выполненное действие (id, serial, ts, action_type, ok, error?, duration_ms?)
- `PhoneAnomalyEvent` — аномалия (id, serial, ts, signature_id, severity, message?, resolved)
- `PhoneRecoveryAttempt` — попытка восстановления (id, serial, ts, strategy, anomaly_id?, success, details?)
- `PhoneGoal` — цель для конкретного телефона (goal_id, serial, kind, status, priority, params?, progress?, created_at, updated_at)
- `PhoneSelector` — `{serials?, shard?, count?, status?}` — селектор для GlobalGoal
- `GlobalGoal` — глобальная цель (goal_id, kind, phone_selector, params?, status, created_at)
- `AutonomySessionDetail` — `{session, last_observation?, last_action?, last_anomaly?}` — detail карточки

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
  - `.Codex-flow`, `.Codex`, `galaxy` исключены из проверки (`files.includes` excludes)
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
