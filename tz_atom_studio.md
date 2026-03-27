# Техническое задание: Atome Studio

## 1. Общая информация

| Параметр | Значение |
|----------|----------|
| **Название проекта** | Atome Studio |
| **Версия документа** | 1.1 |
| **Дата** | 2026-03-27 |
| **Тип продукта** | Веб-платформа мониторинга и визуализации сервисов |
| **Целевые платформы** | Web (Desktop, Tablet ≥ 1024px) |
| **Прототип** | `atomic_monitor.html` (выполнено) |

---

## 2. Описание продукта

### 2.1. Концепция

**Atome Studio** — централизованный дашборд мониторинга для команд разработки. Данные из внешних платформ (Cloudflare, PostHog, Postman и др.) агрегируются через **MCP-серверы** и визуализируются как атомы, вращающиеся по орбитам вокруг центрального ядра в интерактивной космической 2D/3D-сцене.

### 2.2. Проблема

Команды работают с 5–10 разрозненными дашбордами. Переключение между ними занимает время и не даёт единой картины здоровья системы.

### 2.3. Решение

Единое окно с живой визуализацией. Реальные данные платформ подтягиваются через MCP-интеграции и отображаются в реальном времени.

### 2.4. Ключевые метафоры

| Элемент | Значение |
|---------|---------|
| **Ядро (Nucleus)** | Центр системы — символ проекта, пульсирует |
| **Орбита** | Каждая платформа = своя эллиптическая орбита + акцентный цвет |
| **Атом** | Один сервис (Worker, Dashboard, Collection...) — шар на орбите |
| **Галактика** | Фоновая сцена: туманности, звёзды, Млечный путь |

---

## 3. Дизайн-система и стили элементов

### 3.1. Цветовая палитра

| Назначение | Переменная / Значение |
|-----------|----------------------|
| **Фон приложения** | `#01030a` → `#000208` (радиальный градиент) |
| **Панель (sidebar)** | `rgba(1, 4, 16, 0.98)` |
| **Граница панели** | `1px solid rgba(20, 60, 130, 0.2)` |
| **Секционный текст** | `rgba(55, 115, 195, 0.38)` |
| **Основной текст** | `rgba(145, 192, 232, 0.65)` |
| **Акцент cyan** | `#00d8f0` — числа: Services |
| **Акцент teal** | `#00d8a8` — числа: Online, Uptime |
| **Акцент blue** | `#4a9eff` — числа: Platforms |

#### Цвета платформ

| Платформа | Цвет орбиты | HEX | RGBA |
|-----------|------------|-----|------|
| **Cloudflare** | Оранжевый | `#f97316` | `249, 115, 22` |
| **PostHog** | Фиолетовый | `#a78bfa` | `167, 139, 250` |
| **Postman** | Янтарный | `#fbbf24` | `251, 191, 36` |

### 3.2. Типографика

```
font-family: 'Courier New', monospace   /* весь интерфейс */

Заголовок (ptitle):     10px, letter-spacing: 0.2em, uppercase, rgba(80,160,255,.6), font-weight: 700
Подзаголовок (psub):    8.5px, letter-spacing: 0.05em, rgba(55,115,195,.3)
Секция (sec):           7.5px, letter-spacing: 0.22em, uppercase, rgba(55,115,195,.38)
Сервис (svc-nm):        9.5px, letter-spacing: 0.03em, rgba(145,192,232,.65)
Тег типа (svc-tag):     8px, rgba(55,115,195,.35)
Значение стата (val):   20px, font-weight: 700, line-height: 1
Лейбл стата (lbl):      7px, letter-spacing: 0.14em, uppercase, rgba(55,115,195,.38)
Бейдж платформы:        7px, letter-spacing: 0.14em, uppercase, font-weight: 700
```

### 3.3. Компоненты UI — детали

#### Боковая панель `#panel`
```css
width: 264px;
background: rgba(1, 4, 16, 0.98);
border-left: 1px solid rgba(20, 60, 130, 0.2);
padding: 22px 16px 16px;
gap: 18px;
overflow-y: auto;
scrollbar-width: 2px;
scrollbar-color: rgba(40, 90, 180, 0.28);
```

#### Карточка статистики `.sb`
```css
background: rgba(5, 14, 40, 0.72);
border: 1px solid rgba(22, 62, 140, 0.2);
border-radius: 9px;
padding: 9px 11px 8px;
/* Сетка: display: grid; grid-template-columns: 1fr 1fr; gap: 7px */
```

#### Строка сервиса `.svc-row`
```css
display: flex;
align-items: center;
gap: 8px;
padding: 6px 7px;
border-radius: 7px;
cursor: pointer;
transition: background 0.12s;
/* hover: background: rgba(18, 55, 135, 0.14) */
```

#### Индикатор статуса `.dot`
```css
width: 5px;
height: 5px;
border-radius: 50%;

/* online  */ background: #00d8a8; box-shadow: 0 0 6px rgba(0,216,168,.9);
/* idle    */ background: #fbbf24; box-shadow: 0 0 6px rgba(251,191,36,.8);
/* CF      */ background: #f97316; box-shadow: 0 0 6px rgba(249,115,22,.8);
/* PostHog */ background: #a78bfa; box-shadow: 0 0 6px rgba(167,139,250,.8);
/* Postman */ background: #fbbf24; box-shadow: 0 0 6px rgba(251,191,36,.7);
/* offline */ background: #ef4444; box-shadow: 0 0 6px rgba(239,68,68,.8);
```

#### Бейдж платформы `.pf-badge`
```css
font-size: 7px; letter-spacing: 0.14em; text-transform: uppercase;
padding: 3px 8px; border-radius: 4px; font-weight: 700;

/* Cloudflare */ background: rgba(249,115,22,.12); color: #f97316; border: 1px solid rgba(249,115,22,.2);
/* PostHog   */ background: rgba(167,139,250,.12); color: #a78bfa; border: 1px solid rgba(167,139,250,.2);
/* Postman   */ background: rgba(251,191,36,.12);  color: #fbbf24; border: 1px solid rgba(251,191,36,.2);
```

#### Tooltip `#tooltip`
```css
position: fixed; pointer-events: none;
background: rgba(1, 4, 18, 0.97);
border: 1px solid rgba(255, 255, 255, 0.1);
border-radius: 10px;
padding: 10px 16px 11px;
min-width: 180px;
transition: opacity 0.14s ease;

/* tip-platform */ font-size: 8px; letter-spacing: 0.18em; uppercase; margin-bottom: 4px;
/* tip-name     */ font-size: 13px; font-weight: 700; letter-spacing: 0.04em; margin-bottom: 6px;
/* tip-row      */ font-size: 9px; color: rgba(160,195,230,.5); justify-content: space-between;
/* tip-row val  */ color: rgba(200,225,250,.7);
```

#### Sparkline canvas `.sk`
```css
width: 100%; height: 36px;
border-radius: 3px;
/* Заголовок секции */ font-size: 7px; letter-spacing: 0.12em; uppercase; color: rgba(55,115,195,.38);
/* Текущее значение */ font-size: 8.5px; color: rgba(120,178,232,.65);
```

### 3.4. Canvas-сцена

#### Фон (galaxy)
- Радиальный градиент: `#010510` → `#01030a` → `#000208`
- **Туманности**: 5 облаков, radialGradient, цвета: тёмно-фиолетовый, синий, пурпурный, opacity 0.06–0.11
- **Микрозвёзды**: 5500 точек, размер 0.1–0.8px, `rgba(172,208,242, 0.04–0.32)`
- **Млечный путь**: спираль из ~800 частиц

#### Ядро (Nucleus)
- Многослойный radialGradient: белый центр → голубой → тёмный с glow
- Внешнее свечение: несколько концентрических окружностей с убывающей opacity
- Постоянная пульсация (scale 1.0 → 1.08, ~3s цикл)

#### Орбиты
```
Параметры каждой орбиты:
  a (semi-major axis), b (semi-minor axis), tilt (угол наклона в радианах)

Cloudflare: a=196, b=58,  tilt=-0.20, rgb='249,115,22'
PostHog:    a=162, b=80,  tilt= 0.44, rgb='167,139,250'
Postman:    a=226, b=48,  tilt= 0.16, rgb='251,191,36'

Линия орбиты:
  strokeStyle: rgba({rgb}, 0.25)
  lineWidth: 0.5
  lineDash: [4, 8]
```

#### Атомы (сервисы)
- Радиус: `r = 7 * SC * depthScale` (SC = масштаб от размера окна)
- 3D-эффект глубины: атомы "за" ядром — меньше и прозрачнее (`depthScale 0.55–1.0`)
- Заливка: radialGradient (светлее в центре), цвет платформы
- Glow: `shadowBlur = 10 * depthScale`, shadowColor = rgba платформы
- При `status === 'offline'`: пульсирующая красная анимация мигания

---

## 4. Источники данных — MCP-интеграции

> **Ключевое архитектурное решение**: данные в прототипе получены через MCP-серверы (Model Context Protocol), а не через прямые API-вызовы. Финальное приложение использует тот же подход через Claude Agent SDK.

### 4.1. Схема потока данных

```
Пользователь → Atome Studio Backend
                      │
              MCP Client (Claude Agent SDK)
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
  MCP: Cloudflare  MCP: PostHog  MCP: Postman
  (Workers, Pages, (Dashboards,  (Collections,
   DNS Zones)       Insights,     Monitors,
                    Events)       Environments)
```

### 4.2. Cloudflare MCP (`mcp__claude_ai_Cloudflare_Developer_Platform__*`)

| Инструмент | Что получаем | Атом |
|-----------|-------------|------|
| `workers_list` | Список Workers | Тип: `CF Worker` |
| `workers_get_worker` | Статус, дата изменения | `status`, `modified` |
| `r2_buckets_list` | R2 Buckets | Тип: `R2 Bucket` |
| `kv_namespaces_list` | KV Namespaces | Тип: `KV Namespace` |
| `d1_databases_list` | D1 Databases | Тип: `D1 Database` |

**Цвет орбиты**: `#f97316` (оранжевый)
**Авторизация**: Cloudflare API Token (Bearer)

### 4.3. PostHog MCP (`mcp__claude_ai_PostHog__*`)

| Инструмент | Что получаем | Атом |
|-----------|-------------|------|
| `dashboards-get-all` | Список дашбордов | Тип: `Dashboard` |
| `insights-get-all` | Insights (DAU, WAU, Retention, Funnels) | Тип: `PH Insight` |
| `feature-flag-get-all` | Feature Flags | Тип: `Feature Flag` |
| `surveys-get-all` | Опросы | Тип: `Survey` |
| `experiment-get-all` | Эксперименты | Тип: `Experiment` |

**Цвет орбиты**: `#a78bfa` (фиолетовый)
**Авторизация**: PostHog Personal API Key

### 4.4. Postman MCP (`mcp__claude_ai_Postman__*`)

| Инструмент | Что получаем | Атом |
|-----------|-------------|------|
| `getCollections` | Список коллекций | Тип: `API Collection` |
| `getMocks` | Mock-серверы | Тип: `Mock Server` |
| `getEnvironments` | Окружения | Тип: `Environment` |
| `getWorkspaces` | Рабочие пространства | Тип: `Workspace` |
| `getAllSpecs` | API Specs | Тип: `API Spec` |

**Цвет орбиты**: `#fbbf24` (янтарный)
**Авторизация**: Postman API Key

### 4.5. Единый формат объекта сервиса (Service)

```typescript
interface Service {
  id: number;
  name: string;
  platform: 'Cloudflare' | 'PostHog' | 'Postman';
  type: string;          // 'CF Worker' | 'Dashboard' | 'API Collection' | ...
  status: 'online' | 'offline' | 'idle' | 'error';
  modified: string;      // человекочитаемая дата
  col: [number, number, number]; // RGB цвет платформы
  oi: number;            // orbit index (0, 1, 2)
  a: number;             // начальный угол на орбите (радианы)
  spd: number;           // скорость вращения (рад/кадр), знак = направление
}
```

---

## 5. Функциональные требования

### FR-1. Canvas-визуализация (Atomic Canvas)

| ID | Что нужно сделать | Приоритет |
|----|-----------------|-----------|
| FR-1.1 | Перенести прототип `atomic_monitor.html` в React-компонент (`AtomicCanvas`) | P0 |
| FR-1.2 | Canvas должен рендерить фон (галактика), орбиты, ядро, атомы через `requestAnimationFrame` | P0 |
| FR-1.3 | Tooltip при наведении: название, платформа, тип, статус, дата изменения | P0 |
| FR-1.4 | Статус `offline` → атом мигает красным; `idle` → янтарный пульс | P0 |
| FR-1.5 | 3D-эффект глубины: атомы «за» ядром рендерятся меньше и прозрачнее | P0 |
| FR-1.6 | Адаптация под размер окна через ResizeObserver + devicePixelRatio | P0 |
| FR-1.7 | Клик на атом → открывает Detail Panel с данными сервиса | P1 |
| FR-1.8 | Скорость вращения и направление настраиваются per-service | P1 |

### FR-2. Боковая панель (Side Panel)

| ID | Что нужно сделать | Приоритет |
|----|-----------------|-----------|
| FR-2.1 | Шапка: название `Atome Studio`, подзаголовок `workspace · live` | P0 |
| FR-2.2 | Блок статистики: Services, Online, Platforms, Uptime в сетке 2×2 | P0 |
| FR-2.3 | Список сервисов, сгруппированных по платформам (бейдж + счётчик + строки) | P0 |
| FR-2.4 | Строка сервиса: цветная точка-статус, название, тег типа | P0 |
| FR-2.5 | Sparkline-графики: Events/min, API calls, Latency (canvas, 36px высота) | P1 |
| FR-2.6 | Наведение на строку сервиса → подсвечивает атом на Canvas (ring вокруг) | P2 |
| FR-2.7 | Клик на строку сервиса → открывает Detail Panel | P1 |

### FR-3. Данные — MCP-интеграции

| ID | Что нужно сделать | Приоритет |
|----|-----------------|-----------|
| FR-3.1 | Backend: MCP Client на Claude Agent SDK для Cloudflare, PostHog, Postman | P0 |
| FR-3.2 | Polling каждых N секунд (настраивается, по умолчанию 30s) | P0 |
| FR-3.3 | Кэширование ответов MCP в Redis | P1 |
| FR-3.4 | Нормализация данных в единый формат `Service` | P0 |
| FR-3.5 | WebSocket: push обновлений статусов на фронтенд в реальном времени | P1 |
| FR-3.6 | Расширяемость: добавление новой платформы = новый MCP-адаптер | P1 |

### FR-4. Аутентификация

| ID | Что нужно сделать | Приоритет |
|----|-----------------|-----------|
| FR-4.1 | Регистрация и вход по email + пароль | P0 |
| FR-4.2 | JWT + Refresh token | P0 |
| FR-4.3 | OAuth через GitHub | P1 |

### FR-5. Настройки подключений

| ID | Что нужно сделать | Приоритет |
|----|-----------------|-----------|
| FR-5.1 | UI для добавления/удаления MCP-подключений (ввод API-ключей) | P0 |
| FR-5.2 | Проверка соединения при сохранении (`Test Connection`) | P0 |
| FR-5.3 | Хранение API-ключей в зашифрованном виде (AES-256) | P0 |
| FR-5.4 | Настройка интервала polling | P1 |

### FR-6. Алерты

| ID | Что нужно сделать | Приоритет |
|----|-----------------|-----------|
| FR-6.1 | Атом мигает при `status: offline/error` | P0 |
| FR-6.2 | In-app тост при смене статуса | P1 |
| FR-6.3 | Email/Webhook уведомления | P2 |

---

## 6. Нефункциональные требования

| ID | Требование | Метрика |
|----|-----------|---------|
| NFR-1 | Canvas: 60fps при 50+ атомах | ≥ 55fps |
| NFR-2 | Первый рендер | < 2s (LCP) |
| NFR-3 | Минимальная ширина экрана | 1024px |
| NFR-4 | API-ключи зашифрованы | AES-256 at rest |
| NFR-5 | До 100 сервисов на workspace | Без деградации |
| NFR-6 | Кроссбраузерность | Chrome, Firefox, Safari, Edge (last 2) |

---

## 7. Архитектура

### 7.1. Схема

```
┌──────────────────────────────────────────┐
│              Frontend (React SPA)        │
│  ┌─────────────┐   ┌────────────────┐   │
│  │ AtomicCanvas│   │   SidePanel    │   │
│  │  (Canvas2D) │   │ (stats+list+   │   │
│  │             │   │  sparklines)   │   │
│  └─────────────┘   └────────────────┘   │
└──────────────┬───────────────────────────┘
               │ REST + WebSocket
┌──────────────┴───────────────────────────┐
│              Backend API (NestJS)        │
│  ┌──────────┐  ┌───────────┐  ┌───────┐ │
│  │   Auth   │  │MCP Client │  │Alerts │ │
│  │  Module  │  │(Agent SDK)│  │Engine │ │
│  └──────────┘  └─────┬─────┘  └───────┘ │
└────────────────────── │──────────────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
   MCP: Cloudflare  MCP: PostHog  MCP: Postman
```

### 7.2. Стек

| Слой | Технология |
|------|-----------|
| **Frontend** | React + TypeScript + Vite |
| **Canvas** | Canvas 2D API (raw, без библиотек) |
| **State** | Zustand |
| **Backend** | Node.js + NestJS |
| **MCP Client** | Claude Agent SDK (`@anthropic-ai/claude-code`) |
| **БД** | PostgreSQL |
| **Кэш** | Redis |
| **Очереди** | BullMQ (Redis) — polling MCP |
| **Auth** | JWT + Refresh tokens |
| **Деплой** | Docker + Docker Compose |
| **CI/CD** | GitHub Actions |

### 7.3. Структура проекта

```
atome-studio/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── AtomicCanvas/   # Canvas-компонент (из прототипа)
│   │       │   ├── SidePanel/      # Статистика + список сервисов
│   │       │   ├── Tooltip/        # Tooltip при наведении
│   │       │   └── Sparkline/      # Мини-графики активности
│   │       ├── stores/             # Zustand: services, ui, auth
│   │       ├── api/                # WebSocket клиент + REST
│   │       └── pages/
│   │
│   └── api/
│       └── src/
│           ├── auth/
│           ├── mcp/                # MCP Client + адаптеры
│           │   ├── cloudflare/
│           │   ├── posthog/
│           │   └── postman/
│           ├── services/           # Нормализация + кэш
│           ├── alerts/
│           └── websocket/
│
├── packages/
│   └── shared/                     # Типы Service, Platform, Alert
│
├── atomic_monitor.html             # Прототип (референс)
├── docker-compose.yml
└── package.json
```

---

## 8. Модель данных

```typescript
// Пользователь
User { id, email, password_hash, name, created_at }

// Workspace
Workspace { id, name, owner_id, settings: JSON, created_at }
WorkspaceMember { workspace_id, user_id, role: 'owner'|'admin'|'viewer' }

// MCP-подключение (вместо прямых API-ключей)
PlatformConnection {
  id, workspace_id,
  platform: 'cloudflare' | 'posthog' | 'postman',
  credentials: AES256(JSON),   // API ключи для MCP-сервера
  config: JSON,                // polling_interval, filters
  status: 'active' | 'error' | 'disabled',
  last_synced_at
}

// Сервис (нормализованный атом)
Service {
  id, connection_id, external_id,
  name, type,
  status: 'online' | 'offline' | 'idle' | 'error',
  metadata: JSON,    // platform-specific raw data
  orbit_index: 0|1|2,
  last_checked_at, modified_at
}

// Алерт
Alert {
  id, workspace_id, service_id,
  type: 'status_change' | 'metric_threshold',
  severity: 'info' | 'warning' | 'critical',
  message, resolved, created_at, resolved_at
}
```

---

## 9. API — основные эндпоинты

### Auth
| Метод | Endpoint | |
|-------|---------|--|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| POST | `/api/auth/refresh` | Обновление токена |
| GET  | `/api/auth/me` | Текущий пользователь |

### Connections (MCP-подключения)
| Метод | Endpoint | |
|-------|---------|--|
| GET  | `/api/workspaces/:id/connections` | Список подключений |
| POST | `/api/workspaces/:id/connections` | Добавить платформу |
| POST | `/api/connections/:id/test` | Проверить соединение |
| POST | `/api/connections/:id/sync` | Принудительная синхронизация |
| PUT  | `/api/connections/:id` | Обновить настройки |
| DELETE | `/api/connections/:id` | Удалить |

### Services
| Метод | Endpoint | |
|-------|---------|--|
| GET | `/api/workspaces/:id/services` | Все сервисы (с группировкой) |
| GET | `/api/services/:id` | Детали сервиса |

### WebSocket Events
| Событие | Описание |
|---------|---------|
| `service:status_changed` | Изменение статуса → перекраска атома |
| `service:metrics_updated` | Новые данные → обновление sparklines |
| `alert:created` | Новый алерт → тост + мигание атома |

---

## 10. Фазы разработки

### Фаза 1 — MVP (4–6 недель)
- [x] Прототип визуализации (`atomic_monitor.html`)
- [ ] **Frontend**: перенос Canvas-сцены в React + SidePanel + Tooltip
- [ ] **Backend**: Auth + Workspaces + MCP Client (Cloudflare, PostHog, Postman)
- [ ] **Polling**: BullMQ-очередь, нормализация данных в `Service`
- [ ] **Настройки**: UI добавления API-ключей, Test Connection
- [ ] **WebSocket**: push статусов на фронт

### Фаза 2 — Real-time и алерты (3–4 недели)
- [ ] Алерты: мигание + in-app тосты
- [ ] OAuth GitHub
- [ ] Sparklines на реальных данных (events/min, latency)
- [ ] Фильтрация и поиск сервисов
- [ ] Redis-кэш для MCP-ответов

### Фаза 3 — Команды (2–3 недели)
- [ ] Multi-workspace
- [ ] Приглашение участников + роли
- [ ] Email/Webhook нотификации
- [ ] История алертов

### Фаза 4 — Полировка (2 недели)
- [ ] Анимации переходов в панели
- [ ] Оптимизация Canvas при 100+ атомах
- [ ] Мобильная адаптация ≥ 768px (только просмотр)
- [ ] OpenAPI-документация

---

## 11. Критерии приёмки (Definition of Done)

- [ ] Все P0-требования реализованы и работают
- [ ] Canvas: ≥ 55fps при 50 атомах (проверить Chrome DevTools)
- [ ] Данные из Cloudflare, PostHog, Postman отображаются как атомы
- [ ] Статус `offline` визуально отличим (мигание, цвет)
- [ ] API-ключи хранятся зашифрованными
- [ ] Unit-тесты ≥ 70% бизнес-логики backend
- [ ] CI/CD pipeline настроен

---

## 12. Риски

| Риск | Вероятность | Митигация |
|------|------------|-----------|
| Rate limiting MCP-серверов | Высокая | Redis-кэш + настраиваемый polling interval |
| Изменение MCP API | Средняя | Адаптеры за интерфейсом, версионирование |
| Canvas ≥ 100 атомов | Низкая | Виртуализация, LOD, OffscreenCanvas |
| Утечка API-ключей | Низкая | AES-256 at rest, env vars, аудит доступа |

---

## 13. Глоссарий

| Термин | Определение |
|--------|------------|
| **Атом** | Визуальный шар на Canvas = один сервис платформы |
| **Орбита** | Эллиптическая траектория одной платформы |
| **Ядро** | Центральный пульсирующий объект Canvas |
| **MCP** | Model Context Protocol — протокол получения данных от платформ через Claude Agent SDK |
| **Adapter** | Модуль нормализации данных от конкретного MCP в формат `Service` |
| **Sparkline** | Миниатюрный линейный график активности (36px canvas) |
| **Polling** | Периодический запрос данных через MCP-клиент |
