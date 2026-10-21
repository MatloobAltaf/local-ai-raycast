import { describe, expect, it } from "vitest";
import { loadVersionedStore, type VersionedStoreSpec } from "./versioned-store";

const spec: VersionedStoreSpec<{ items: number[] }> = {
  version: 2,
  parse: (value) =>
    Array.isArray(value.items) ? { store: { items: value.items as number[] }, changed: false } : undefined,
};

describe("loadVersionedStore", () => {
  it("reports empty for missing data", () => {
    expect(loadVersionedStore(undefined, spec)).toEqual({ kind: "empty" });
  });

  it("reports corrupt for invalid json, non-objects and missing versions", () => {
    expect(loadVersionedStore("nope", spec)).toEqual({ kind: "corrupt", raw: "nope" });
    expect(loadVersionedStore("[1]", spec)).toEqual({ kind: "corrupt", raw: "[1]" });
    expect(loadVersionedStore('{"items":[]}', spec)).toEqual({ kind: "corrupt", raw: '{"items":[]}' });
    expect(loadVersionedStore('{"version":0,"items":[]}', spec).kind).toBe("corrupt");
  });

  it("reports corrupt when the parser rejects the shape", () => {
    expect(loadVersionedStore('{"version":2}', spec).kind).toBe("corrupt");
  });

  it("reports newer versions without parsing", () => {
    expect(loadVersionedStore('{"version":3,"items":"x"}', spec)).toEqual({ kind: "newer", version: 3 });
  });

  it("returns the parsed store, marking older versions as changed", () => {
    expect(loadVersionedStore('{"version":2,"items":[1]}', spec)).toEqual({
      kind: "ok",
      store: { items: [1] },
      changed: false,
    });
    expect(loadVersionedStore('{"version":1,"items":[1]}', spec)).toEqual({
      kind: "ok",
      store: { items: [1] },
      changed: true,
    });
  });
});
