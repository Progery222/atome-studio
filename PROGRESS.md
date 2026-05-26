# Atome Studio — Progress Tracker
> Обновляй этот файл после каждого завершённого шага

---

## Фаза 1 — Реальные данные в Galaxy

- [x] **1.1** Типы в shared (`Phone`, `Account`, `QueueTask`, `FarmEvent`, `VideoFile`, `GenerationJob`)
- [x] **1.2** `SportZavodAdapter` — GET `:8000/health`, `/api/jobs`
- [x] **1.3** `FarmAdapter` — GET `:8001/api/status`, `/api/metrics`
- [x] **1.4** `ContentZavodAdapter` — GET `:8002/health`
- [x] **1.5** Зарегистрировать адаптеры в `McpService.fetchAllServices()`
- [x] **1.6** `GET /api/services/stats` в `ServicesController` → FarmStats
- [x] **1.7** Web: убрать `DEMO_SERVICES`, добавить `fetchServices()` + `fetchStats()` через Vite proxy
- [x] **1.8** Web: SidePanel с 4 виджетами FarmStats + карточка сервиса при клике на атом

> 🧪 **Тест фазы 1:** `npm run dev` → открыть Galaxy → видны 3 атома (SportZavod, content-zavod, Orchestrator) + 4 виджета с реальными данными

---

## Фаза 2 — Роутер + Телефоны + Аккаунты

- [x] **2.1** Установить `react-router-dom`, настроить все маршруты в `App.tsx`
- [x] **2.2** Компонент `Layout` с sidebar-навигацией (скрыт на `/`)
- [x] **2.3** API: `GET /api/phones` → прокси к orchestrator `:8001/api/devices`
- [x] **2.4** API: `GET /api/phones/:id`, `POST .../pause`, `POST .../resume`
- [x] **2.5** API: `GET /api/accounts`, `POST /api/accounts`
- [x] **2.6** Web: страница `/phones` — сетка `PhoneCard` (статус, health, посты, кнопки)
- [x] **2.7** Web: страница `/phones/:id` — детальная страница телефона
- [x] **2.8** Web: страница `/accounts` — таблица аккаунтов
- [x] **2.9** Web: страница `/accounts/:id` — детальная страница аккаунта
- [x] **2.10** Web: модалка `CreateAccountModal` — создание аккаунта

> 🧪 **Тест фазы 2:** перейти `/phones` → карточки телефонов → нажать Пауза/Возобновить → статус меняется; `/accounts` → таблица; `CreateAccountModal` → POST /api/accounts → строка в таблице

---

## Фаза 3 — Генерация + Очередь + WebSocket

- [x] **3.1** API: `POST /api/generate` → прокси в SportZavod `:8000` или content-zavod `:8002`
- [x] **3.2** API: `GET /api/jobs/:id` → polling статуса генерации
- [x] **3.3** API: `GET /api/queue` → прокси к orchestrator task list
- [x] **3.4** API: `EventsGateway` (Socket.io) — мост браузер ↔ NestJS ↔ orchestrator `/ws/events`
- [x] **3.5** Web: `FarmStore` (Zustand) — phones, queue, wsEvents; polling обновление каждые 10с
- [x] **3.6** Web: страница `/generate` — форма выбора + прогресс-бар по этапам
- [x] **3.7** Web: страница `/queue` — список задач + countdown-таймер + auto-refresh

> 🧪 **Тест фазы 3:** `/generate` → выбрать аккаунты → запустить → видеть прогресс → после завершения перейти в `/queue` → карточка с таймером; WS событие `published` → карточка ✅

---

## Фаза 4 — Видеотека + Авторизация

- [x] **4.1** Docker: добавить MinIO в `docker-compose.yml` (port 9000/9001)
- [x] **4.2** API: `MinioService` + `GET /api/videos` (список файлов по tenant_id)
- [x] **4.3** Web: страница `/videos` — сетка карточек сгруппированных по дате
- [x] **4.4** API: доработать `AuthModule` — refresh token, `X-Api-Key` для inter-service
- [x] **4.5** Web: страница `/login` — форма email + пароль
- [x] **4.6** Web: `AuthGuard` + редирект на `/login` если нет токена

> 🧪 **Тест фазы 4:** открыть без токена → редирект на `/login`; войти → перейти на `/`; `/videos` → карточки видео с кнопкой скачать

---

## Фаза 5 — Клиенты (super_admin)

- [x] **5.1** API: `GET/POST/PATCH /api/clients` → orchestrator tenants
- [x] **5.2** API: `POST /api/clients/:id/assign-phones`
- [x] **5.3** Web: страница `/clients` — таблица + форма создания (только super_admin)

> 🧪 **Тест фазы 5:** войти как super_admin → виден `/clients` в sidebar → создать клиента → назначить телефоны

---

---

## Фаза 6 — Foundation (CSS + shared types + MetricChart)

- [x] **6.1** CSS-переменные: `--color-success`, `--color-warning`, `--color-error`, `--chart-grid`, `--chart-tooltip-bg`
- [x] **6.2** Shared types: `ServiceMetricsPoint`, `ActivityEvent`, `HeroKPI`, `BotStatus`, `MetricsHistoryPoint`, `MetricsHistoryResponse`
- [x] **6.3** `MetricChart` компонент — pure Canvas 2D, типы line/area/bar/donut/gauge/sparkline

> 🧪 **Тест:** `npm run dev` стартует без ошибок, `tsc --noEmit` проходит

---

## Фаза 7 — Investor Visual (Galaxy overlay)

- [x] **7.1** `MetricsStore` (Zustand) — `kpis: HeroKPI`, `fetchKPIs()` → `GET /api/services/kpis`
- [x] **7.2** `ActivityStore` (Zustand) — кольцевой буфер `max 50`, `push()`
- [x] **7.3** `HeroKPIs` компонент — 5 карточек с count-up, delta, sparkline
- [x] **7.4** `ActivityFeed` компонент — скролл-лог событий с `slideIn` анимацией
- [x] **7.5** `GalaxyPage` обновлён — overlay HeroKPIs (top) + ActivityFeed (right) + Analytics в nav
- [x] **7.6** `farm.ts` → ActivityStore — маппинг FarmEvent → ActivityEvent в `connectWs()`
- [x] **7.7** Backend: `GET /api/services/kpis` — `getHeroKPIs()` в `ServicesService`

> 🧪 **Тест:** Galaxy → 5 KPI-карточек сверху, ActivityFeed справа

---

## Фаза 8 — Analytics Page

- [x] **8.1** Backend: `MetricsModule` — in-memory time-series, `GET /api/metrics/history?period&resolution`
- [x] **8.2** Frontend: `AnalyticsPage` — 5 KPI + 5 charts с period toggle (7d/14d/30d)
- [x] **8.3** Routing: `/analytics` в App.tsx + Layout sidebar + i18n 4 языка

> 🧪 **Тест:** `/analytics` → 5 KPI + 5 графиков в neon-теме, period toggle работает

---

## Фаза 9 — i18n: полная локализация + переименование

- [x] **9.1** `i18n/index.ts` — добавлено ~280 ключей (все 4 локали: ru/en/zh/es) + `LOCALE_MAP` + `getT()`
- [x] **9.2** Переименование: "Ферма телефонов" → "Device Fleet" (en) / "Парк устройств" (ru) / "设备舰队" (zh) / "Flota de dispositivos" (es)
- [x] **9.3** `SidePanel.tsx`, `PhonesPage.tsx`, `AccountsPage.tsx`, `CreateAccountModal.tsx` — мигрированы
- [x] **9.4** `QueuePage.tsx`, `AccountDetailPage.tsx`, `VideosPage.tsx` — мигрированы + `LOCALE_MAP` для дат
- [x] **9.5** `GeneratePage.tsx` — мигрирован (~40 строк, `useCallback` deps обновлены)
- [x] **9.6** `PlanetPanel.tsx` — `TYPE_LABELS` и `SERVICE_ACTIONS` перенесены внутрь компонента
- [x] **9.7** `ClientsPage.tsx`, `GalaxyPage.tsx`, `AnalyticsPage.tsx` — мигрированы
- [x] **9.8** `PhoneDetailPage.tsx` — мигрирован

> 🧪 **Тест:** переключить язык EN → RU → ZH → ES — все тексты переключаются; Galaxy: "Device Fleet" (en) / "Парк устройств" (ru); даты в /videos и /queue форматируются по локали

---

## Фаза 10 — Resilience & Observability (стоп-кровь)
- [x] **10.1** `apps/api/src/common/circuit-breaker.ts` — CircuitBreaker (closed/open/half-open, 3 fail → open 60s, warn ≤ 1/min) + global registry
- [x] **10.2** `apps/api/src/autonomy/autonomy.service.ts` — обёрнут breaker `orchestrator-autonomy`; убран спам `Orchestrator unavailable: GET ...`
- [x] **10.3** `apps/api/src/queue/queue.service.ts` — обёрнут breaker `orchestrator-queue`
- [x] **10.4** `apps/api/src/health/` — `HealthModule` + `GET /api/health` (Public, без JWT); возвращает `SystemHealth { state, generatedAt, uptimeSec, services[] }` агрегируя `ServicesService.getAll()` + circuit breaker registry
- [x] **10.5** `packages/shared/src/index.ts` — типы `SystemHealth`, `SystemServiceHealth`, `SystemHealthState`
- [x] **10.6** `apps/web/src/stores/health.ts` + `apps/web/src/hooks/useFarmHealth.ts` — Zustand store + 15s polling
- [x] **10.7** `apps/web/src/components/SystemBanner/` — sticky-баннер сверху страницы (скрыт когда state===ok); показывает down/degraded сервисы с stale-временем

> 🧪 **Тест:** `curl http://localhost:4000/api/health` → JSON со state и services[]; в `docker logs atome-api` `Orchestrator unavailable` ≤ 1/мин (вместо ≥ 1/5с); при остановке оркестратора в UI появляется красная плашка

---

## Фаза 11 — Security & Audit

- [x] **11.1** `apps/api/src/auth/auth.service.ts` — убран хардкоженный fallback `admin@atome.studio/admin123`; пользователь сидится из `ADMIN_EMAIL`+`ADMIN_PASSWORD` (compose уже задаёт), без env warn в лог и /api/auth/login отвергает всех
- [x] **11.2** `apps/api/src/main.ts` — подключён `helmet()` (без CSP, чтобы не сломать SPA inline-чанки); `crossOriginResourcePolicy: cross-origin` для совместимости с MinIO
- [x] **11.3** `apps/api/src/app.module.ts` — `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])` глобально + `ThrottlerGuard` в `APP_GUARD`
- [x] **11.4** `apps/api/src/auth/auth.controller.ts` — `@Throttle({ default: { ttl: 60_000, limit: 5 } })` на login/register (5 попыток/мин/IP, 6-я = 429)
- [x] **11.5** `apps/api/src/audit/` — новый AuditModule (Global): `AuditService.log({userId,userEmail,action,target,ip,payload,status})` + `GET /api/audit?action=&userId=&limit=`
- [x] **11.6** `apps/api/prisma/schema.prisma` — модель `AuditLog (id, userId?, userEmail?, action, target?, ip?, payloadJson?, status, createdAt)` + индексы по `[userId, createdAt]` и `[action, createdAt]`
- [x] **11.7** `/opt/nginx-proxy.conf` — блок 444 для known scanner paths (owa/ecp/wp-admin/.git/.env/cgi-bin/...), location-блок для banking-фишинговых JS (lkk_ch/qr_modal/twint_ch), валидный `/robots.txt`, drop по UA (zgrab/nmap/sqlmap/nikto/wpscan), drop не-стандартных HTTP методов (PROPFIND и т.п.); + security headers (X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy)

> 🧪 **Тест проверено в проде (v761503, 2026-04-18):**
> - `curl /owa/auth/x.js` → `HTTP=000` (444 drop) ✓
> - `curl /assets/js/qr_modal.js` → `HTTP=000` ✓
> - `curl -A "zgrab/0.x" /` → `HTTP=000` ✓
> - `curl /robots.txt` → `User-agent: *\nDisallow: /` ✓
> - `curl /` (homepage) → `HTTP=200` ✓
> - 5 wrong logins → 401, 6-й → 429 ✓
> - `/api/audit` без токена → 401 ✓

---

## Фаза 12 — UX (точечно)

- [x] **12.1** `apps/web/src/hooks/useKeyboardShortcuts.ts` + интеграция в Layout — `g + p/v/a/g/q/s/c/n/h` chord для навигации (skipped при фокусе на input/textarea/contenteditable, окно вооружения 1.2с)
- [x] **12.2** Hook перенесён в App-level (`<GlobalShell>`), чтобы работал и на публичной Galaxy, и после login до Layout.
- [x] **12.3** `components/CommandPalette/` — Cmd+K / Ctrl+K палитра со списком команд (навигация по всем страницам, toggle theme, logout), ArrowDown/ArrowUp + Enter, Esc для закрытия.
- [x] **12.4** `styles/themes.css` + `stores/theme.ts` — light/dark темы через CSS-переменные и `data-theme` атрибут на `:root`; persist в localStorage.
- [x] **12.5** `hooks/usePersistedState.ts` — generic useState обёртка в localStorage ключом `atome.ui.<page>.<field>`.
- [x] **12.6** `components/EmptyState/` — общий компонент для пустых списков с title/description/CTA ссылкой.

---

## Фаза 13 — Security hardening (продолжение) + Audit full chain

- [x] **13.1** JWT в **httpOnly cookie** `at` (Secure на HTTPS, SameSite=Lax, 8h TTL). `JwtAuthGuard` принимает Bearer **или** cookie (обратная совместимость). Фронт: `fetch` → `credentials: include`, legacy `localStorage` token читается как fallback. `lib/api.ts` обновлён.
- [x] **13.2** CSRF double-submit: `csrf` cookie (не httpOnly, JS читает) + header `X-CSRF-Token` обязателен для POST/PUT/PATCH/DELETE под `/api/*` (кроме `/api/auth/login|register|logout` и Bearer-клиентов). Middleware `auth/csrf.middleware.ts`. Фронт отправляет автоматически в `apiFetch`.
- [x] **13.3** `auth/ip-allowlist.middleware.ts` — whitelist IP для `/api/clients/*` и `/api/audit/*` через env `ADMIN_ALLOWED_IPS` (comma-separated). По умолчанию отключён (пустой env — skip).
- [x] **13.4** `auth.controller.ts` — эндпоинты: `POST /auth/login`, `POST /auth/register`, `POST /auth/logout` (clearCookie), `GET /auth/me`. Login/register ставят `at` cookie + возвращают токен для legacy. Throttler: 20/мин/IP.
- [x] **13.5** `AuditInterceptor` + `@Audited("action.name")` декоратор (`audit/audited.decorator.ts`). Логирует `{userId, userEmail, action, target (param.id/serial), ip, payload: {method, url, body}, status: ok|error}` в `AuditLog`.
- [x] **13.6** `autonomy.controller.ts` — `@Audited` на `pause/resume/terminate`.
- [x] **13.7** Prisma migration `20260418_add_audit_and_cost_budget` — таблицы `AuditLog` (индексы по `[userId, createdAt]` и `[action, createdAt]`) и `CostBudget` (unique `clientId`, dailyUsd, monthlyUsd, alertThreshold).
- [x] **13.8** `pages/Audit/AuditPage.tsx` — таблица audit log с фильтром по action, super_admin only (route в `App.tsx` под `RoleGuard`).
- [x] **13.9** `auth/auth.service.ts` — закомментирован хардкоженный admin fallback ещё в фазе 11; при отсутствии `ADMIN_EMAIL`/`ADMIN_PASSWORD` warn, USERS = []  → login rejects all.

---

## Фаза 14 — Realtime & code quality

- [x] **14.1** `events/events.gateway.ts` — метод `emitCustom(channel, payload)` для произвольных каналов.
- [x] **14.2** `autonomy.service.ts` — эмитит `autonomy:sessions` после `listSessions()` через `emitIfChanged` (JSON-снапшот key, emit только при изменении).
- [x] **14.3** `autonomy.module.ts` — импортирует `EventsModule`.
- [x] **14.4** `stores/farm.ts` — socket.io handler `autonomy:sessions` → `useAutonomyStore.applySessionsSnapshot(list)`.
- [x] **14.5** `stores/autonomy.ts` — `applySessionsSnapshot(list)` переиспользуется fetch-ом и WS-каналом.
- [x] **14.6** `hooks/useAutonomyPolling.ts` — дефолт 3000ms → 30_000ms (watchdog; живые обновления идут по WS).
- [x] **14.7** `autonomy/envelope.ts` + `.spec.ts` — чистая функция `unwrapEnvelope<T>(data, key): T[]` с 3 vitest-тестами (эктрактит, пустой на invalid shape, правильно типизирует). `getList()` в AutonomyService пользуется ей.
- [x] **14.8** `apps/api/vitest.config.ts` + `test` script; tsconfig исключает `*.spec.ts` из nest build.
- [x] **14.9** `apps/web/package.json` — `e2e` script + `@playwright/test 1.59.1` devDep.
- [x] **14.10** `apps/web/e2e/smoke.spec.ts` + `playwright.config.ts` — 5 тестов (health, login+cookie, CSRF 403, scanner drop on edge, combined: galaxy + login UI + g+p shortcut + Ctrl+K palette).
- [x] **14.11** `.github/workflows/typecheck.yml` — CI: prisma generate + shared build + api tsc + web tsc + biome check + all vitest.

> 🧪 **Тесты — все зелёные на проде (v761503):**
> - `/api/health` → state=ok, 7 services
> - `/api/auth/login` → 201, Set-Cookie `at=...` + `csrf=...`
> - `/api/auth/me` с cookie → 200
> - POST без CSRF-header → 403
> - POST с CSRF-header → 201 (и audit-запись появляется)
> - `/api/audit` → 1+ записей по `autonomy.pause`
> - `/api/auth/logout` → 201
> - vitest: 3 passed
> - Playwright: **5/5 passed** (13.2s)
>   - health endpoint responds
>   - login API sets at cookie
>   - CSRF blocks POST without token
>   - scanner paths are dropped on https edge
>   - galaxy loads + login + shortcuts + palette (combined)

---

## Легенда

| Символ | Статус |
|--------|--------|
| `[ ]` | Не начато |
| `[~]` | В процессе |
| `[x]` | Завершено и протестировано |
| `[!]` | Заблокировано / проблема |
