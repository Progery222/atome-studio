import { afterEach, describe, expect, it } from "vitest";
import { validateEnv } from "./env";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("validateEnv", () => {
  it("requires JWT_SECRET", () => {
    delete process.env.JWT_SECRET;

    expect(() => validateEnv()).toThrow("JWT_SECRET is required");
  });

  it("loads defaults and reports local dependency warnings", () => {
    process.env.JWT_SECRET = "test-secret";
    delete process.env.MINIO_URL;
    delete process.env.SPORTZAVOD_URL;
    delete process.env.CONTENTZAVOD_URL;

    const result = validateEnv();

    expect(result.config.port).toBe(3001);
    expect(result.config.minioBucket).toBe("atome-videos");
    expect(result.warnings.some((warning) => warning.startsWith("MINIO_URL="))).toBe(true);
  });
});
