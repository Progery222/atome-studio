---
name: project-architect
description: Используй этот скилл при принятии архитектурных решений в Atome Studio — выбор технологий, проектирование модулей, структура проекта, проектирование API, схема базы данных, паттерны проектирования, интеграционная архитектура, масштабирование. Активируй при словах: архитектура, стек, структура проекта, база данных, схема данных, API design, микросервисы, монолит, модульная архитектура, паттерн, масштабирование, плагинная система.
---

# Atome Studio — Архитектор

Скилл для принятия архитектурных решений проекта Atome Studio.

## Утверждённый стек

| Слой | Технология |
|------|-----------|
| Frontend | React + TypeScript + Vite |
| Canvas | Canvas 2D / WebGL |
| State | Zustand |
| Backend | Node.js + NestJS |
| БД | PostgreSQL |
| Кэш | Redis |
| Очереди | BullMQ (Redis) |
| Auth | JWT + Refresh tokens |
| Деплой | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Monorepo | pnpm workspaces |

## Структура проекта

```
atome-studio/
├── apps/
│   ├── web/          # Frontend SPA (React)
│   └── api/          # Backend API (NestJS)
├── packages/
│   └── shared/       # Общие типы и утилиты
├── docker-compose.yml
└── package.json
```

## Принципы архитектуры

1. **Модульность** — каждая платформа = отдельный адаптер в `apps/api/src/platforms/`
2. **Плагинная система** — новые платформы добавляются через реализацию интерфейса `PlatformAdapter`
3. **Separation of concerns** — Canvas-логика отделена от React-компонентов
4. **Кэширование** — данные от платформ кэшируются в Redis, polling в фоне через BullMQ
5. **Real-time** — WebSocket для push-обновлений на фронтенд
6. **Type safety** — общие типы в `packages/shared`

## Интерфейс адаптера платформы

```typescript
interface PlatformAdapter {
  readonly platform: PlatformType;
  validateCredentials(credentials: Record<string, string>): Promise<boolean>;
  fetchServices(connection: PlatformConnection): Promise<ServiceData[]>;
  getServiceDetails(connection: PlatformConnection, serviceId: string): Promise<ServiceDetails>;
  getMetrics?(connection: PlatformConnection, serviceId: string): Promise<MetricData[]>;
}
```

## Модель данных

Основные сущности: User, Workspace, WorkspaceMember, PlatformConnection, Service, Alert.
Полная схема: см. раздел 9 в `tz_atom_studio.md`.

## Алгоритм принятия решений

1. Прочитай ТЗ (`tz_atom_studio.md`) — разделы 7–10
2. Проверь, соответствует ли решение утверждённому стеку
3. Убедись в совместимости с плагинной архитектурой
4. Оцени влияние на производительность (NFR-1: ≥ 55fps)
5. Документируй ADR (Architecture Decision Record) при значимых изменениях

## Формат ADR

```markdown
## ADR-XXX: [Название решения]

**Статус**: Принято / На рассмотрении / Отклонено
**Дата**: YYYY-MM-DD

### Контекст
[Почему нужно принять решение]

### Решение
[Что решили]

### Альтернативы
[Что рассматривали]

### Последствия
[Плюсы и минусы решения]
```
