---
name: project-frontend
description: Используй этот скилл при работе с фронтендом Atome Studio — React-компоненты, Canvas-визуализация, вёрстка, интеграция с API, state management, маршрутизация, анимации, адаптивная вёрстка, Zustand stores. Активируй при словах: фронтенд, компонент, React, Canvas, визуализация, вёрстка, стили, Zustand, store, хук, hook, страница, маршрут, Vite, TypeScript frontend, атом визуализация, орбита, ядро canvas.
---

# Atome Studio — Frontend-разработка

Скилл для фронтенд-разработки проекта Atome Studio.

## Стек

- **React 18+** с TypeScript (strict mode)
- **Vite** — сборщик
- **Zustand** — state management
- **Canvas 2D** — визуализация (возможен переход на WebGL/PixiJS)
- **CSS Modules** или **Tailwind CSS** — стили
- **React Router** — маршрутизация

## Структура `apps/web/src/`

```
src/
├── canvas/              # Модуль Canvas-визуализации
│   ├── AtomicCanvas.ts  # Главный класс рендеринга
│   ├── Nucleus.ts       # Отрисовка ядра
│   ├── Orbit.ts         # Отрисовка орбит
│   ├── Atom.ts          # Отрисовка атомов (сервисов)
│   ├── Galaxy.ts        # Фоновая галактика
│   ├── Tooltip.ts       # Логика тултипа
│   └── types.ts         # Canvas-специфичные типы
├── components/          # React UI компоненты
│   ├── SidePanel/       # Боковая панель
│   ├── Sparkline/       # Графики активности
│   ├── ServiceList/     # Список сервисов
│   ├── StatusBadge/     # Индикатор статуса
│   └── Layout/          # Общий layout
├── pages/               # Страницы
│   ├── Dashboard/       # Главная (Canvas + Panel)
│   ├── Settings/        # Настройки подключений
│   ├── Auth/            # Логин/регистрация
│   └── Workspace/       # Управление workspace
├── stores/              # Zustand stores
│   ├── servicesStore.ts # Сервисы и их статусы
│   ├── authStore.ts     # Аутентификация
│   └── settingsStore.ts # Настройки UI
├── api/                 # API-клиент
│   ├── client.ts        # Axios/fetch обёртка
│   ├── auth.ts          # Auth endpoints
│   ├── services.ts      # Services endpoints
│   └── connections.ts   # Platform connections
├── hooks/               # Custom hooks
│   ├── useCanvas.ts     # Управление Canvas
│   ├── useWebSocket.ts  # WS-соединение
│   └── useServices.ts   # Данные сервисов
└── types/               # Общие TypeScript типы
```

## Правила разработки

1. **Canvas отделён от React** — Canvas-модуль не импортирует React. Связь через stores и events
2. **Компоненты — функциональные** с hooks
3. **Типы** — строгая типизация, no `any`
4. **Файл = один компонент** — именование PascalCase
5. **CSS** — модульные стили, без глобальных классов (кроме reset)
6. **Производительность Canvas** — target ≥ 55fps при 50 атомах

## Существующий прототип

Файл `atomic_monitor.html` содержит рабочий прототип визуализации:
- Galaxy background с nebula, звёздами, Milky Way
- Nucleus (3D-сфера с lens flare)
- 3 орбиты (Cloudflare, PostHog, Postman)
- 10 атомов с trail-эффектом, 3D-сферами, pulse rings
- Tooltip при наведении
- Side panel со sparklines

**При рефакторинге**: извлечь логику из HTML в модули `canvas/`.

## Шаблон React-компонента

```tsx
import { FC } from 'react';
import styles from './ComponentName.module.css';

interface ComponentNameProps {
  // props
}

export const ComponentName: FC<ComponentNameProps> = ({ ...props }) => {
  return (
    <div className={styles.root}>
      {/* content */}
    </div>
  );
};
```

## Шаблон Zustand store

```typescript
import { create } from 'zustand';

interface ServicesState {
  services: Service[];
  isLoading: boolean;
  fetchServices: (workspaceId: string) => Promise<void>;
}

export const useServicesStore = create<ServicesState>((set) => ({
  services: [],
  isLoading: false,
  fetchServices: async (workspaceId) => {
    set({ isLoading: true });
    // fetch logic
    set({ services: data, isLoading: false });
  },
}));
```
