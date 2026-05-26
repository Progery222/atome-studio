# ADR 0001: Modular Monolith

## Decision

Use a modular monolith for Atome Studio.

## Context

The product coordinates one dashboard, one API, shared contracts, and several external services. The main risk today is accidental coupling and unclear ownership, not independent scaling of every capability.

## Consequences

- One deployable API remains simpler to run and debug.
- Domain modules stay explicit under `apps/api/src`.
- Shared contracts stay in `packages/shared`.
- External service integration details stay behind backend services/adapters.
- If load or ownership boundaries become real constraints, modules can be extracted later with clearer seams.
