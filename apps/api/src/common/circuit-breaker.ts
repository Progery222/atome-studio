import { Logger } from "@nestjs/common";

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitStatus {
  name: string;
  state: CircuitState;
  failureCount: number;
  lastFailureAt: number | null;
  openedAt: number | null;
  lastSuccessAt: number | null;
}

export interface CircuitOptions {
  failureThreshold?: number;
  cooldownMs?: number;
  warnIntervalMs?: number;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailureAt: number | null = null;
  private openedAt: number | null = null;
  private lastSuccessAt: number | null = null;
  private lastWarnAt = 0;

  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly warnIntervalMs: number;
  private readonly log: Logger;

  constructor(public readonly name: string, opts: CircuitOptions = {}) {
    this.failureThreshold = opts.failureThreshold ?? 3;
    this.cooldownMs = opts.cooldownMs ?? 60_000;
    this.warnIntervalMs = opts.warnIntervalMs ?? 60_000;
    this.log = new Logger(`Circuit:${name}`);
  }

  shouldSkip(): boolean {
    if (this.state === "open" && this.openedAt && Date.now() - this.openedAt > this.cooldownMs) {
      this.state = "half-open";
      this.log.log(`probing after cooldown`);
    }
    return this.state === "open";
  }

  onSuccess() {
    if (this.state !== "closed") {
      this.log.log(`recovered (was ${this.state})`);
    }
    this.state = "closed";
    this.failureCount = 0;
    this.openedAt = null;
    this.lastSuccessAt = Date.now();
  }

  onFailure(reason: string) {
    this.failureCount++;
    this.lastFailureAt = Date.now();
    if (this.state === "half-open" || this.failureCount >= this.failureThreshold) {
      if (this.state !== "open") {
        this.state = "open";
        this.openedAt = Date.now();
        this.log.warn(`open after ${this.failureCount} failures: ${reason}`);
      }
    }
    const now = Date.now();
    if (now - this.lastWarnAt > this.warnIntervalMs) {
      this.log.warn(`fail (${this.state}, ${this.failureCount}): ${reason}`);
      this.lastWarnAt = now;
    }
  }

  status(): CircuitStatus {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureAt: this.lastFailureAt,
      openedAt: this.openedAt,
      lastSuccessAt: this.lastSuccessAt,
    };
  }
}

const registry = new Map<string, CircuitBreaker>();

export function getBreaker(name: string, opts?: CircuitOptions): CircuitBreaker {
  let b = registry.get(name);
  if (!b) {
    b = new CircuitBreaker(name, opts);
    registry.set(name, b);
  }
  return b;
}

export function allBreakers(): CircuitStatus[] {
  return [...registry.values()].map((b) => b.status());
}
