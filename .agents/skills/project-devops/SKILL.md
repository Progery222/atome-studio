---
name: project-devops
description: Используй этот скилл при работе с инфраструктурой Atome Studio — Docker, Docker Compose, CI/CD, GitHub Actions, деплой, окружения, мониторинг, переменные окружения, Dockerfile, nginx, SSL, база данных в контейнере. Активируй при словах: Docker, Dockerfile, docker-compose, CI/CD, GitHub Actions, деплой, deploy, окружение, environment, nginx, SSL, контейнер, продакшн, staging, инфраструктура, переменные окружения, env.
---

# Atome Studio — DevOps

Скилл для инфраструктуры и деплоя проекта Atome Studio.

## Стек инфраструктуры

- **Docker + Docker Compose** — контейнеризация
- **GitHub Actions** — CI/CD
- **PostgreSQL** — БД (контейнер для dev, managed для prod)
- **Redis** — кэш и очереди (контейнер)
- **Nginx** — reverse proxy (prod)

## Docker Compose структура

```yaml
services:
  web:        # Frontend (Vite build → nginx)
  api:        # Backend (NestJS)
  postgres:   # PostgreSQL
  redis:      # Redis
  nginx:      # Reverse proxy (prod only)
```

## Окружения

| Окружение | Описание | БД | Доступ |
|-----------|----------|-----|--------|
| **local** | Локальная разработка | Docker PostgreSQL | localhost |
| **staging** | Тестовое | Managed PostgreSQL | Команда |
| **production** | Продакшн | Managed PostgreSQL | Пользователи |

## Переменные окружения

### Backend (`apps/api/.env`)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/atome_studio
REDIS_URL=redis://localhost:6379
JWT_SECRET=<secret>
JWT_REFRESH_SECRET=<secret>
ENCRYPTION_KEY=<32-byte-hex>  # Для шифрования API-ключей платформ
PORT=3001
NODE_ENV=development
```

### Frontend (`apps/web/.env`)
```
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
```

## CI/CD Pipeline (GitHub Actions)

```
push/PR → lint → test → build → [deploy]

Stages:
1. Lint: eslint + prettier check
2. Test: unit tests + e2e (with test DB)
3. Build: Docker images (web + api)
4. Deploy (main branch only): push to registry → deploy
```

## Правила

1. **Никогда не коммить .env файлы** — только `.env.example`
2. **Multi-stage Docker builds** — минимальный размер образов
3. **Health checks** — для всех сервисов в docker-compose
4. **Volumes** — для данных PostgreSQL и Redis (dev)
5. **Логирование** — JSON формат, stdout

## Шаблон Dockerfile (Backend)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

## SLA метрики

- Uptime: ≥ 99.5%
- Время деплоя: < 5 минут
- Время восстановления (RTO): < 30 минут
