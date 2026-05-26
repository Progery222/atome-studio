# Architecture

Atome Studio is kept as a modular monolith: one deployable application with clear module boundaries.

## Boundaries

- `apps/web/src/pages` is presentation: routing-level screens and view composition.
- `apps/web/src/components` is reusable UI.
- `apps/web/src/stores` is frontend application state and API orchestration.
- `apps/api/src/<module>` is backend application module code: controllers expose HTTP, services own use cases and orchestration.
- `apps/api/src/shared` is cross-cutting backend infrastructure used by modules.
- `apps/api/src/prisma` is database infrastructure.
- `packages/shared` is the stable contract layer for DTOs and shared types.

## Rules

1. Controllers validate and translate HTTP concerns; product behavior belongs in services/use cases.
2. Shared DTOs and externally visible data shapes go through `packages/shared`.
3. Environment access is centralized through `apps/api/src/shared/config`.
4. External services should use timeouts and return explicit fallback states.
5. New infrastructure helpers live under `apps/api/src/shared` or a clearly named module, not inside feature UI.
6. Database changes go through Prisma schema and migrations.
7. Important architecture decisions get a short ADR in `docs/adr`.

## Current Shape

```text
apps/
  api/
    src/
      auth/
      farm/
      generation/
      streamcut/
      shared/
        config/
      prisma/
  web/
    src/
      pages/
      components/
      stores/
      lib/
packages/
  shared/
docs/
  adr/
scripts/
tools/
```
