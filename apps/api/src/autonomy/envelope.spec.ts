import { describe, expect, it } from "vitest";
import { unwrapEnvelope } from "./envelope";

describe("unwrapEnvelope", () => {
  it("extracts the array under the given key", () => {
    expect(unwrapEnvelope({ sessions: [1, 2] }, "sessions")).toEqual([1, 2]);
  });

  it("returns [] for wrong shape", () => {
    expect(unwrapEnvelope({ sessions: null }, "sessions")).toEqual([]);
    expect(unwrapEnvelope({ events: [] }, "sessions")).toEqual([]);
    expect(unwrapEnvelope(null, "sessions")).toEqual([]);
    expect(unwrapEnvelope(undefined, "sessions")).toEqual([]);
    expect(unwrapEnvelope("oops", "sessions")).toEqual([]);
  });

  it("narrows the type correctly", () => {
    const items = unwrapEnvelope<{ id: number }>({ items: [{ id: 1 }, { id: 2 }] }, "items");
    expect(items[0].id).toBe(1);
  });
});
