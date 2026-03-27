---
name: project-qa
description: Используй этот скилл при тестировании Atome Studio — написание тестов, тест-планы, тест-кейсы, unit-тесты, e2e-тесты, тестирование API, тестирование Canvas, регрессия, баги, quality assurance. Активируй при словах: тест, тестирование, test, Jest, Vitest, Cypress, Playwright, unit test, e2e, интеграционный тест, баг, bug, тест-кейс, тест-план, QA, регрессия, покрытие, coverage.
---

# Atome Studio — QA / Тестирование

Скилл для тестирования проекта Atome Studio.

## Стек тестирования

| Тип | Инструмент | Область |
|-----|-----------|---------|
| Unit (Frontend) | Vitest + React Testing Library | Компоненты, hooks, stores |
| Unit (Backend) | Jest | Сервисы, адаптеры, утилиты |
| E2E | Playwright | Пользовательские сценарии |
| API | Supertest (в Jest) | Эндпоинты Backend |
| Canvas | Manual + Screenshot tests | Визуализация |

## Стратегия покрытия

| Слой | Target Coverage | Приоритет |
|------|----------------|-----------|
| Backend services | ≥ 80% | P0 |
| Platform adapters | ≥ 70% | P0 |
| Frontend stores | ≥ 70% | P1 |
| React components | ≥ 50% | P1 |
| E2E critical paths | 100% | P0 |
| Canvas rendering | Manual QA | P2 |

## Критические пользовательские пути (E2E)

1. **Регистрация → Вход → Dashboard** — пользователь видит Canvas
2. **Подключение платформы** — добавить Cloudflare → сервисы появляются
3. **Real-time обновление** — изменение статуса сервиса отображается
4. **Алерт** — при падении сервиса появляется нотификация

## Шаблон Unit-теста (Backend)

```typescript
describe('CloudflareAdapter', () => {
  let adapter: CloudflareAdapter;

  beforeEach(() => {
    adapter = new CloudflareAdapter(mockHttpService);
  });

  it('should fetch workers list', async () => {
    mockHttpService.get.mockResolvedValue({ data: mockWorkersResponse });

    const services = await adapter.fetchServices(mockConnection);

    expect(services).toHaveLength(1);
    expect(services[0].name).toBe('tracker-worker');
    expect(services[0].status).toBe('online');
  });

  it('should handle invalid credentials', async () => {
    mockHttpService.get.mockRejectedValue(new Error('401'));

    const isValid = await adapter.validateCredentials({ apiToken: 'invalid' });

    expect(isValid).toBe(false);
  });
});
```

## Шаблон E2E-теста (Playwright)

```typescript
test('user can connect Cloudflare platform', async ({ page }) => {
  await page.goto('/settings/connections');
  await page.click('[data-testid="add-connection"]');
  await page.click('[data-testid="platform-cloudflare"]');
  await page.fill('[data-testid="api-token"]', process.env.TEST_CF_TOKEN!);
  await page.click('[data-testid="connect-btn"]');

  await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Active');

  await page.goto('/');
  await expect(page.locator('canvas#c')).toBeVisible();
});
```

## Definition of Done

- [ ] Unit-тесты написаны и проходят
- [ ] Покрытие соответствует target
- [ ] E2E-тесты для критических путей проходят
- [ ] Нет P0/P1 багов
- [ ] Canvas рендерит ≥ 55fps при 50 атомах
- [ ] API отвечает < 200ms (p95)
