# ТЗ: Панель управления — Atome Studio Dashboard
> Версия: 1.0 | Дата: 2026-03-30 | Статус: актуально

---

## 1. КОНТЕКСТ И ЦЕЛЬ

### 1.1 Что строим

Веб-панель управления единой системой публикации контента в TikTok. Панель объединяет 3 сервиса:

| Сервис | Роль |
|--------|------|
| **SportZavod** `:8000` | Генерирует спортивные видео (HeyGen + OpenAI) |
| **content-zavod** `:8002` | Генерирует универсальные видео (Replicate/Kling) |
| **Orchestrator** `:8001` | Управляет фермой телефонов, публикует в TikTok |

### 1.2 Для кого

| Роль | Кто | Что делает в панели |
|------|-----|---------------------|
| **Super Admin** | Владелец системы | Всё + управление клиентами |
| **Tenant Admin** | Клиент | Управляет своими телефонами и аккаунтами |
| **Viewer** | Наблюдатель клиента | Только просмотр статистики |

### 1.3 Что уже есть

- `apps/web` — React + Three.js, 3D галактика атомов работает (demo-данные)
- `apps/api` — NestJS, поллинг Cloudflare/PostHog/Postman каждые 30 сек
- Дизайн-система, компоненты, Zustand store — готовы
- Orchestrator API `:8001` — работает (FastAPI, Redis, PostgreSQL)
- Worker — читает Redis, ReAct loop работает

### 1.4 Что нужно добавить

Подключить панель к реальным данным и добавить экраны управления.

---

## 2. АРХИТЕКТУРА ДАННЫХ

### 2.1 Источники данных

```
Dashboard Web (apps/web)
    ↕ REST + WebSocket
Dashboard API (apps/api, NestJS :3001)
    ├── GET /api/services     → агрегирует от всех сервисов
    ├── GET /api/phones       → от orchestrator
    ├── GET /api/accounts     → от orchestrator
    ├── GET /api/queue        → от orchestrator
    ├── GET /api/videos       → от MinIO
    ├── POST /api/generate    → в SportZavod / content-zavod
    └── WS  /ws/events        → от orchestrator (real-time)
```

### 2.2 Модели данных (TypeScript)

```typescript
// Телефон / устройство
interface Phone {
  phone_id: string           // "phone_001"
  serial: string             // ADB serial
  tenant_id: string          // UUID
  model: string              // "SM-G780G"
  status: 'active' | 'warmup' | 'paused' | 'offline' | 'banned' | 'error'
  warmup_day: number         // 0-30
  health_score: number       // 0.0 - 1.0
  accounts: Account[]        // аккаунты на телефоне
  adb_connected: boolean
  group: string              // "batch_1", "sports", "lifestyle"
  last_active: string        // ISO datetime
  actions_today: number
  posts_today: number
}

// Аккаунт в TikTok
interface Account {
  account_id: string         // UUID
  tenant_id: string
  phone_id: string
  platform: 'tiktok'
  username: string           // "@nba_acc_01"
  niche: string              // "sports_nba" | "lifestyle" | "fitness"
  content_sources: string[]  // ["sportzavod", "contentzavod"]
  heygen_avatar_id?: string
  post_frequency_hours: number
  timezone: string
  health_score: number       // 0.0 - 1.0
  warmup_day: number
  status: 'active' | 'warmup' | 'paused' | 'banned'
  stats: {
    posts_today: number
    posts_week: number
    posts_total: number
    last_post: string | null
  }
}

// Задача в очереди публикации
interface QueueTask {
  task_id: string
  account_id: string
  phone_id: string
  file_url: string           // MinIO URL
  caption: string
  hashtags: string[]
  platform: 'tiktok'
  source_service: 'sportzavod' | 'contentzavod'
  status: 'scheduled' | 'in_progress' | 'published' | 'failed'
  scheduled_at: string       // ISO datetime
  executed_at?: string
  created_at: string
  thumbnail_url?: string
}

// Событие реального времени (WebSocket)
interface FarmEvent {
  event: 'published' | 'banned' | 'error' | 'heartbeat' | 'job_complete'
  phone_id: string
  account_id?: string
  details: Record<string, unknown>
  timestamp: string
}

// Видеофайл в MinIO
interface VideoFile {
  filename: string
  account_id: string
  tenant_id: string
  source_service: 'sportzavod' | 'contentzavod'
  url: string
  thumbnail_url: string
  size_bytes: number
  created_at: string
  status: 'queued' | 'published' | 'rejected'
}

// Задание генерации
interface GenerationJob {
  job_id: string
  service: 'sportzavod' | 'contentzavod'
  account_ids: string[]
  topic?: string             // только для contentzavod
  videos_per_account: number
  status: 'running' | 'done' | 'error'
  progress: number           // 0-100
  created_at: string
  results?: { account_id: string; video_url: string }[]
}
```

---

## 3. ЭКРАНЫ И ФУНКЦИОНАЛЬНОСТЬ

### 3.1 Навигация

```
/                     → Galaxy (3D визуализация сервисов) — главная
/phones               → Ферма телефонов
/phones/:phone_id     → Детальная страница телефона
/accounts             → Все аккаунты
/accounts/:account_id → Детальная страница аккаунта
/generate             → Запуск генерации контента
/queue                → Очередь публикаций
/videos               → Библиотека видео (MinIO)
/clients              → Управление клиентами (только super_admin)
/settings             → Настройки профиля
```

---

### 3.2 Экран: Galaxy (главная, `/`)

**Что показывает:** 3D визуализация системы в виде атомов — уже реализована. Нужно подключить к реальным данным.

#### FR-1. Атомы в галактике

| ID | Требование | Приоритет |
|----|-----------|-----------|
| FR-1.1 | 3 атома: SportZavod, content-zavod, Orchestrator — всегда | P0 |
| FR-1.2 | Цвет атома зависит от статуса: зелёный (online), жёлтый (degraded), красный (offline) | P0 |
| FR-1.3 | При наведении — тултип: название, статус, ключевая метрика | P0 |
| FR-1.4 | При клике на атом — боковая панель с деталями сервиса | P0 |
| FR-1.5 | Орбиты: у каждого атома своё кол-во орбит = кол-во процессов | P1 |
| FR-1.6 | Электроны на орбитах светятся ярче при активной работе | P1 |
| FR-1.7 | Световые дуги между атомами — пульсируют когда контент передаётся | P2 |

#### FR-2. Мини-дашборды на главной

| ID | Требование | Приоритет |
|----|-----------|-----------|
| FR-2.1 | Виджет "Публикаций сегодня" — суммарно по всем телефонам | P0 |
| FR-2.2 | Виджет "Телефонов онлайн" — X / total | P0 |
| FR-2.3 | Виджет "Аккаунтов активных" — X / total | P0 |
| FR-2.4 | Виджет "Последнее событие" — последнее из WS событий | P1 |
| FR-2.5 | Виджет "Генерируется сейчас" — кол-во активных job'ов | P1 |

#### FR-3. Данные для галактики (NestJS адаптеры)

| ID | Требование | Приоритет |
|----|-----------|-----------|
| FR-3.1 | `SportZavodAdapter` — GET `:8000/health`, `:8000/api/jobs` | P0 |
| FR-3.2 | `FarmAdapter` — GET `:8001/api/status`, `:8001/api/devices` | P0 |
| FR-3.3 | `ContentZavodAdapter` — GET `:8002/health`, `:8002/api/jobs` | P0 |
| FR-3.4 | Polling каждые 30 сек (уже есть в ServicesService) | P0 |
| FR-3.5 | WebSocket подключение к `:8001/ws/events` | P0 |
| FR-3.6 | Zustand store обновляется из polling + WebSocket | P0 |

---

### 3.3 Экран: Ферма телефонов (`/phones`)

**Что показывает:** все телефоны с их статусом в реальном времени.

#### Макет

```
┌─────────────────────────────────────────────────────────┐
│  Ферма телефонов           [+ Добавить]  [Фильтр ▾]    │
│  ● 87 онлайн  ○ 8 оффлайн  ⚠ 5 warmup  ✕ 0 бан        │
├─────────────────────────────────────────────────────────┤
│ Группы: [Все] [batch_1] [sports] [lifestyle] [test]     │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ phone_001│ │ phone_002│ │ phone_003│ │ phone_004│  │
│  │ ● active │ │ ● active │ │ ⚠ warmup │ │ ○ offline│  │
│  │ @luna... │ │ @layla...│ │ day 3/14 │ │          │  │
│  │ ♥ 0.95   │ │ ♥ 0.88   │ │ ♥ 1.00   │ │          │  │
│  │ 3 posts  │ │ 1 post   │ │ 0 posts  │ │          │  │
│  │ [Пауза]  │ │ [Пауза]  │ │ [View]   │ │ [View]   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### FR-4. Список телефонов

| ID | Требование | Приоритет |
|----|-----------|-----------|
| FR-4.1 | Показывать все телефоны тенанта карточками (grid layout) | P0 |
| FR-4.2 | На карточке: phone_id, статус, аккаунт, health_score, posts_today | P0 |
| FR-4.3 | Цвет индикатора статуса: зелёный/жёлтый/красный/серый | P0 |
| FR-4.4 | Фильтр по группе телефонов | P1 |
| FR-4.5 | Фильтр по статусу (active/warmup/offline/banned) | P1 |
| FR-4.6 | Поиск по phone_id или username | P1 |
| FR-4.7 | Кнопки "Пауза" / "Возобновить" прямо на карточке | P0 |
| FR-4.8 | Данные обновляются из Redis heartbeat каждые 5 сек (уже пишется воркером) | P0 |
| FR-4.9 | Если adb_connected=false — предупреждение на карточке | P1 |

#### FR-5. Детальная страница телефона (`/phones/:phone_id`)

| ID | Требование | Приоритет |
|----|-----------|-----------|
| FR-5.1 | Статус, модель, ADB serial, группа, warmup день | P0 |
| FR-5.2 | Health score с историей (мини-график за 7 дней) | P0 |
| FR-5.3 | Статистика: likes/comments/views/posts сегодня | P0 |
| FR-5.4 | Текущая очередь задач на этот телефон | P0 |
| FR-5.5 | Последние 20 действий из actions_log | P1 |
| FR-5.6 | Кнопки: Пауза / Возобновить / Стоп | P0 |
| FR-5.7 | Снимок экрана телефона (GET `/api/devices/:phone_id/screenshot`) | P1 |
| FR-5.8 | Live-лог событий через WebSocket | P1 |

---

### 3.4 Экран: Аккаунты (`/accounts`)

**Что показывает:** все TikTok-аккаунты, привязанные к телефонам.

#### Макет

```
┌─────────────────────────────────────────────────────────┐
│  Аккаунты                [+ Создать]  [Импорт GSheets]  │
│  🔍 Поиск по username...              [Фильтр: Ниша ▾]  │
├──────────┬──────────────┬────────┬──────────┬──────────┤
│ Аккаунт  │ Телефон      │ Ниша   │ Health   │ Посты    │
├──────────┼──────────────┼────────┼──────────┼──────────┤
│ @luna... │ phone_001    │ fashion│ ████ 95% │ 3 сег.   │
│ @layla.. │ phone_002    │ ceramic│ ███░ 88% │ 1 сег.   │
│ @nba_01  │ phone_007    │ sports │ █████100%│ 0 сег.   │
└──────────┴──────────────┴────────┴──────────┴──────────┘
```

#### FR-6. Список аккаунтов

| ID | Требование | Приоритет |
|----|-----------|-----------|
| FR-6.1 | Таблица: username, phone_id, ниша, health_score, статус, посты сегодня | P0 |
| FR-6.2 | Клик на строку → `/accounts/:account_id` | P0 |
| FR-6.3 | Фильтр по нише (sports_nba / lifestyle / fitness / …) | P1 |
| FR-6.4 | Фильтр по статусу (active / warmup / banned) | P1 |
| FR-6.5 | Кнопка "Создать" — модалка создания аккаунта | P0 |
| FR-6.6 | Кнопка "Импорт Google Sheets" — вызов POST `:8000/api/accounts/reload` | P1 |

#### FR-7. Создание аккаунта (модалка)

| ID | Требование | Приоритет |
|----|-----------|-----------|
| FR-7.1 | Поля: username, phone_id (dropdown), ниша, timezone | P0 |
| FR-7.2 | Поле: источники контента (мультиселект: sportzavod, contentzavod) | P0 |
| FR-7.3 | Поле: post_frequency_hours (ползунок 4-24ч) | P0 |
| FR-7.4 | Поле: heygen_avatar_id (если sportzavod выбран) | P1 |
| FR-7.5 | Сохранение через POST `:8001/api/accounts` | P0 |

#### FR-8. Детальная страница аккаунта (`/accounts/:account_id`)

| ID | Требование | Приоритет |
|----|-----------|-----------|
| FR-8.1 | Все поля аккаунта с редактированием (inline edit) | P0 |
| FR-8.2 | График публикаций за последние 30 дней | P1 |
| FR-8.3 | Список последних опубликованных видео с превью | P1 |
| FR-8.4 | История изменений health_score (мини-график) | P1 |
| FR-8.5 | Кнопка: Запустить генерацию для этого аккаунта | P0 |
| FR-8.6 | Текущая позиция в очереди публикаций | P0 |

---

### 3.5 Экран: Запуск генерации (`/generate`)

**Что делает:** позволяет запустить генерацию видео из Dashboard → задание уходит в SportZavod или content-zavod.

#### Макет

```
┌─────────────────────────────────────────────────────────┐
│  Генерация контента                                      │
│                                                          │
│  Сервис: ○ SportZavod (спорт)  ○ content-zavod (любой) │
│                                                          │
│  Аккаунты: [Выбрать аккаунты ▾]          Все / По нише │
│  ┌──────────────────────────────────────┐               │
│  │ ☑ @nba_acc_01 (phone_007, sports)    │               │
│  │ ☑ @nba_acc_02 (phone_003, sports)    │               │
│  │ ☐ @luna_01    (phone_001, lifestyle) │               │
│  └──────────────────────────────────────┘               │
│                                                          │
│  Видео на аккаунт: [1] [2] [3]                          │
│  Тема (опц.): [__________________________________]       │
│  (только для content-zavod)                              │
│                                                          │
│           [Запустить генерацию →]                       │
└─────────────────────────────────────────────────────────┘
```

#### FR-9. Запуск генерации

| ID | Требование | Приоритет |
|----|-----------|-----------|
| FR-9.1 | Выбор сервиса: SportZavod или content-zavod | P0 |
| FR-9.2 | Мультиселект аккаунтов с фильтром по нише | P0 |
| FR-9.3 | Кнопки "Все" / "По нише" для быстрого выбора | P1 |
| FR-9.4 | Поле "Видео на аккаунт" (1-5) | P0 |
| FR-9.5 | Поле "Тема" — только если выбран content-zavod | P0 |
| FR-9.6 | При нажатии "Запустить" → POST `/api/generate` в Dashboard API | P0 |
| FR-9.7 | Dashboard API проксирует в нужный сервис (SportZavod :8000 или content-zavod :8002) | P0 |
| FR-9.8 | Прогресс генерации — polling GET `/api/jobs/:id` каждые 5 сек | P0 |

#### FR-10. Прогресс генерации (live)

| ID | Требование | Приоритет |
|----|-----------|-----------|
| FR-10.1 | После запуска — полоса прогресса с этапами (SportZavod: 7 этапов) | P0 |
| FR-10.2 | Список: аккаунт → статус этапа → иконка ✅/⏳/❌ | P0 |
| FR-10.3 | Когда видео готово — превью-миниатюра | P1 |
| FR-10.4 | Кнопка "Отмена" пока job не завершён | P1 |
| FR-10.5 | По завершении — кнопка перейти в очередь публикаций | P0 |

---

### 3.6 Экран: Очередь публикаций (`/queue`)

**Что показывает:** что стоит в очереди на публикацию, когда будет опубликовано, статус.

#### Макет

```
┌─────────────────────────────────────────────────────────┐
│  Очередь публикаций         [Фильтр: Все статусы ▾]    │
│                                                          │
│  Сегодня запланировано: 48  │  Опубликовано: 12  │  ❌3 │
├────────────────────────────────────────────────────────-┤
│ [превью] @nba_acc_01  phone_007   ●  сейчас публикуется │
│          "NBA Finals highlights..." → 14:30 EST          │
│                                                          │
│ [превью] @nba_acc_02  phone_003   ⏰ через 2ч 15м       │
│          "Lakers trade rumors..."  → 16:45 EST           │
│                                                          │
│ [превью] @luna_01     phone_001   ⏰ через 4ч            │
│          "Spring fashion trends..."→ 18:00 EST           │
│                                                          │
│ [превью] @layla_01    phone_002   ✅ опубликовано 11:30  │
│          "Ceramic workshop..."     ✓ 847 views в 1ч      │
└─────────────────────────────────────────────────────────┘
```

#### FR-11. Список очереди

| ID | Требование | Приоритет |
|----|-----------|-----------|
| FR-11.1 | Список всех задач: превью, аккаунт, телефон, статус, scheduled_at | P0 |
| FR-11.2 | Сортировка по scheduled_at ASC (ближайшие вверху) | P0 |
| FR-11.3 | Фильтр по статусу: scheduled / in_progress / published / failed | P0 |
| FR-11.4 | Фильтр по аккаунту / нише | P1 |
| FR-11.5 | "Публикуется сейчас" выделено зелёным с анимацией | P0 |
| FR-11.6 | Через WS события `published` / `failed` — список обновляется real-time | P0 |
| FR-11.7 | Кнопка "Удалить из очереди" для scheduled задач | P1 |
| FR-11.8 | Кнопка "Повторить" для failed задач | P1 |

#### FR-12. Плитка задачи в очереди

| ID | Требование | Приоритет |
|----|-----------|-----------|
| FR-12.1 | Миниатюра видео (если есть thumbnail_url) или плейсхолдер | P0 |
| FR-12.2 | Caption (первые 80 символов) + список хэштегов | P0 |
| FR-12.3 | Иконка источника: 🏈 SportZavod / 🎬 content-zavod | P1 |
| FR-12.4 | Таймер обратного отсчёта до scheduled_at | P1 |

---

### 3.7 Экран: Видеотека (`/videos`)

**Что показывает:** все сгенерированные видео в MinIO. Поиск, фильтрация, скачивание.

#### Макет

```
┌─────────────────────────────────────────────────────────┐
│  Видеотека            🔍 [Поиск...]  [Фильтр: Все ▾]   │
│  Март 2026 — 342 видео  │  Занято: 48.2 GB              │
├─────────────────────────────────────────────────────────┤
│  Март 30  ──────────────────────────────────            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │
│  │  MP4   │ │  MP4   │ │  MP4   │ │  MP4   │           │
│  │ @nba01 │ │ @nba02 │ │ @luna  │ │ @layla │           │
│  │ 14:30  │ │ 16:45  │ │ 18:00  │ │ 11:30  │           │
│  │[↓][👁] │ │[↓][👁] │ │[↓][👁] │ │[↓][👁] │           │
│  └────────┘ └────────┘ └────────┘ └────────┘           │
└─────────────────────────────────────────────────────────┘
```

#### FR-13. Библиотека видео

| ID | Требование | Приоритет |
|----|-----------|-----------|
| FR-13.1 | Сетка карточек с превью, сгруппированных по дате | P0 |
| FR-13.2 | На карточке: аккаунт, дата, источник, статус (queued/published) | P0 |
| FR-13.3 | Кнопка скачать → прямой MinIO URL | P0 |
| FR-13.4 | Клик на превью → модалка с видеоплеером | P1 |
| FR-13.5 | Фильтр по аккаунту, нише, источнику, статусу | P1 |
| FR-13.6 | Фильтр по дате (диапазон) | P1 |
| FR-13.7 | Показатель занятого места | P2 |
| FR-13.8 | Удаление видео (только если статус = queued, не published) | P2 |

---

### 3.8 Экран: Клиенты (`/clients`) — только super_admin

#### FR-14. Управление тенантами

| ID | Требование | Приоритет |
|----|-----------|-----------|
| FR-14.1 | Таблица клиентов: имя, тариф, телефонов, аккаунтов, активен | P0 |
| FR-14.2 | Кнопка создать клиента (имя, email, пароль, тариф, max_phones) | P0 |
| FR-14.3 | Назначить телефоны из пула → клиенту | P0 |
| FR-14.4 | Деактивировать клиента (is_active=false) | P0 |
| FR-14.5 | Статистика публикаций по клиенту | P1 |

---

## 4. АВТОРИЗАЦИЯ

### FR-15. Auth

| ID | Требование | Приоритет |
|----|-----------|-----------|
| FR-15.1 | Страница входа `/login` — email + пароль | P0 |
| FR-15.2 | JWT токен — хранить в localStorage | P0 |
| FR-15.3 | Refresh token — автоматическое обновление | P1 |
| FR-15.4 | Редирект на `/login` если токен истёк | P0 |
| FR-15.5 | Роль передаётся в JWT (super_admin / tenant_admin / viewer) | P0 |
| FR-15.6 | Viewer не видит кнопки создания/управления | P0 |
| FR-15.7 | `/clients` скрыт для всех кроме super_admin | P0 |
| FR-15.8 | Каждый запрос от Dashboard API к другим сервисам — с `X-Api-Key` | P0 |

---

## 5. REAL-TIME (WebSocket)

### FR-16. События через WebSocket

**Подключение:** Dashboard Web → Dashboard API → Orchestrator `:8001/ws/events`

| ID | Событие | Что делает Dashboard |
|----|---------|---------------------|
| FR-16.1 | `published` | Карточка в очереди → ✅ опубликовано + счётчик + атом пульсирует |
| FR-16.2 | `failed` | Карточка в очереди → ❌ + alert |
| FR-16.3 | `banned` | Карточка телефона → красный + badge BAN |
| FR-16.4 | `heartbeat` | Статус телефона обновляется (online/offline) |
| FR-16.5 | `job_complete` | Прогресс генерации → 100% + превью видео |

---

## 6. НЕФУНКЦИОНАЛЬНЫЕ ТРЕБОВАНИЯ

| ID | Требование | Значение |
|----|-----------|----------|
| NFR-1 | Время загрузки первого экрана | < 3 сек |
| NFR-2 | Время обновления статуса телефона | < 5 сек |
| NFR-3 | Кол-во телефонов без деградации UI | 500+ карточек с виртуализацией |
| NFR-4 | Работа без интернета (локальная сеть) | Всё на localhost |
| NFR-5 | Браузеры | Chrome, Safari последние 2 версии |
| NFR-6 | Адаптивность | Desktop только (min-width: 1280px) |

---

## 7. СТЕК ТЕХНОЛОГИЙ

### Frontend (apps/web) — уже задан
```
React 18 + TypeScript
Three.js               ← 3D галактика
Zustand                ← state management
Vite                   ← сборка
CSS Modules            ← стили
```

### Backend (apps/api) — уже задан
```
NestJS + TypeScript
PostgreSQL             ← через orchestrator
Redis                  ← через orchestrator
JWT                    ← авторизация
WebSocket (ws)         ← подключение к orchestrator
```

### Инфраструктура — нужно поднять
```
MinIO :9000/:9001      ← хранилище видео (docker)
```

---

## 8. ИНТЕГРАЦИИ (API контракты)

### 8.1 Dashboard API → Orchestrator (уже реализовано в orchestrator)

```
GET  /health                     → статус orchestrator
GET  /api/status                 → сводка фермы (active/error/banned counts)
GET  /api/devices                → список телефонов
GET  /api/devices/:phone_id      → детали телефона
GET  /api/devices/:phone_id/screenshot → скриншот (base64)
POST /api/devices/:phone_id/pause    → пауза
POST /api/devices/:phone_id/resume   → возобновить
POST /api/content/queue          → поставить видео в очередь
GET  /api/personas               → список персон
GET  /api/accounts               → список аккаунтов (нужно добавить)
POST /api/accounts               → создать аккаунт (нужно добавить)
GET  /api/metrics                → метрики для Dashboard (нужно добавить)
WS   /ws/events                  → real-time события (нужно добавить)
```

### 8.2 Dashboard API → SportZavod

```
GET  /health                     → статус
POST /api/generate               → запуск генерации { account_ids, videos_per_account }
GET  /api/jobs                   → список jobs
GET  /api/jobs/:id               → статус job
POST /api/jobs/:id/stop          → отмена
GET  /api/accounts               → список аккаунтов (SportZavod)
POST /api/accounts/reload        → перезагрузка из Google Sheets
```

### 8.3 Dashboard API → content-zavod

```
GET  /health                     → статус (нужно добавить)
POST /api/generate               → { account_id, topic, videos_per_account } (нужно добавить)
GET  /api/jobs/:id               → статус (нужно добавить)
```

### 8.4 Dashboard API → MinIO

```
GET  /api/videos                 → список файлов по tenant_id
GET  /api/videos/:account_id     → файлы конкретного аккаунта
DELETE /api/videos/:filename     → удаление (если не published)
```

---

## 9. ПЛАН РЕАЛИЗАЦИИ

### Фаза 1 — Подключить реальные данные в галактику (2-3 дня)

```
[ ] apps/api: SportZavodAdapter — GET :8000/health, /api/jobs
[ ] apps/api: FarmAdapter — GET :8001/status, /api/devices
[ ] apps/api: ContentZavodAdapter — GET :8002/health
[ ] apps/api: добавить адаптеры в McpService.fetchAllServices()
[ ] apps/web: убрать DEMO_SERVICES из services.ts store
[ ] apps/web: добавить fetch('localhost:3001/api/services') в store
[ ] apps/web: виджеты на главной (4 счётчика)
```

### Фаза 2 — Ферма и аккаунты (3-4 дня)

```
[ ] apps/api: GET /api/phones → прокси к orchestrator
[ ] apps/api: GET /api/accounts → прокси к orchestrator
[ ] apps/api: POST /api/accounts → прокси к orchestrator
[ ] apps/web: страница /phones — сетка карточек
[ ] apps/web: страница /phones/:id — детали
[ ] apps/web: страница /accounts — таблица
[ ] apps/web: страница /accounts/:id — детали
[ ] apps/web: модалка создания аккаунта
```

### Фаза 3 — Генерация и очередь (3-4 дня)

```
[ ] apps/api: POST /api/generate → проксирует в SportZavod или content-zavod
[ ] apps/api: GET /api/queue → прокси к orchestrator task list
[ ] apps/web: страница /generate — форма запуска + прогресс
[ ] apps/web: страница /queue — список + real-time обновление
[ ] apps/api: WebSocket → orchestrator /ws/events
[ ] apps/web: Zustand store для WS событий
```

### Фаза 4 — Видеотека и авторизация (2-3 дня)

```
[ ] Поднять MinIO в Docker
[ ] apps/api: MinIO клиент — листинг файлов
[ ] apps/web: страница /videos — сетка с превью
[ ] apps/api: JWT авторизация (NestJS AuthModule)
[ ] apps/web: страница /login
[ ] apps/web: AuthGuard для всех маршрутов
```

### Фаза 5 — Клиенты (2-3 дня)

```
[ ] apps/api: CRUD /api/clients → tenants таблица в orchestrator
[ ] apps/web: страница /clients (super_admin)
[ ] apps/api: назначение телефонов клиенту
```

---

## 10. USER STORIES

| ID | User Story | Acceptance Criteria |
|----|-----------|---------------------|
| US-1.1 | Как **tenant admin**, я хочу видеть статус всех телефонов с первого взгляда, чтобы понимать работает ли ферма | Главная показывает: кол-во онлайн/оффлайн, цвет атома orchestrator меняется при сбое |
| US-1.2 | Как **tenant admin**, я хочу запустить генерацию видео для конкретных аккаунтов, чтобы не делать это через Telegram бот | Форма /generate: выбрать аккаунты → запустить → видеть прогресс по этапам |
| US-1.3 | Как **tenant admin**, я хочу видеть когда будет опубликован следующий пост, чтобы планировать активность | Экран /queue: отсортированный список с таймерами и real-time обновлением |
| US-1.4 | Как **tenant admin**, я хочу скачать конкретное видео до публикации, чтобы проверить качество | Экран /videos: кнопка скачать на каждой карточке → браузер загружает MP4 |
| US-1.5 | Как **tenant admin**, я хочу поставить телефон на паузу если что-то идёт не так, не перезапуская систему | Кнопка Пауза на карточке /phones → orchestrator получает PATCH, Worker останавливает цикл |
| US-2.1 | Как **super admin**, я хочу создать нового клиента и назначить ему телефоны из пула, чтобы он мог начать работу | Форма /clients: имя, email, тариф, назначить телефоны → клиент получает логин |
| US-2.2 | Как **super admin**, я хочу видеть статистику по всем клиентам, чтобы понимать загрузку системы | Таблица /clients показывает posts_today, phones_online, health_avg по каждому тенанту |
| US-3.1 | Как **viewer**, я хочу видеть сколько видео опубликовано сегодня и их статусы, чтобы отчитываться клиенту | /queue и /phones доступны в read-only, без кнопок управления |

---

## 11. ЧТО НЕ ВХОДИТ В ТЗ

- Редактор видео в браузере
- Встроенный плеер статистики TikTok (likes/views после публикации)
- Мобильная версия
- Email-уведомления
- Тёмная/светлая тема переключения (используем тёмную как дефолт)
