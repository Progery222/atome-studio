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

## Легенда

| Символ | Статус |
|--------|--------|
| `[ ]` | Не начато |
| `[~]` | В процессе |
| `[x]` | Завершено и протестировано |
| `[!]` | Заблокировано / проблема |
