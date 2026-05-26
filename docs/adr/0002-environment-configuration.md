# ADR 0002: Environment Configuration

## Decision

Centralize backend environment parsing and validation in `apps/api/src/shared/config`.

## Context

The API depends on JWT secrets, service URLs, MinIO settings, and admin bootstrap credentials. Reading raw `process.env` throughout the app makes defaults and production requirements hard to audit.

## Consequences

- Startup fails early when required secrets are missing.
- Local defaults remain visible in one place.
- Modules can migrate gradually from direct `process.env` access to `AppConfigService`.
- Tests can cover config behavior without starting the whole Nest app.
