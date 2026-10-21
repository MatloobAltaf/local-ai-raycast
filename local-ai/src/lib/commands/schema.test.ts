import { describe, expect, it } from "vitest";
import { migrateCommandStore, normalizeCommand } from "./schema";

const defaults = { model: "system", creativity: "normal" } as const;

const validCommand = {
  id: "c1",
  name: "Fix",
  icon: "Wand",
  prompt: "Fix {selection}",
  output: "replace",
  model: "system",
  creativity: "precise",
  useCase: "general",
  guardrails: "permissive",
  pinned: true,
  isStarter: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function store(commands: unknown[]): string {
  return JSON.stringify({ version: 1, commands });
}

describe("migrateCommandStore", () => {
  it("classifies empty, corrupt and newer data", () => {
    expect(migrateCommandStore(undefined, defaults)).toEqual({ kind: "empty" });
    expect(migrateCommandStore("not json", defaults)).toEqual({ kind: "corrupt", raw: "not json" });
    expect(migrateCommandStore('{"version":2,"commands":[]}', defaults)).toEqual({ kind: "newer", version: 2 });
  });

  it("leaves a complete store unchanged", () => {
    const result = migrateCommandStore(store([validCommand]), defaults);
    expect(result).toEqual({ kind: "ok", store: { version: 1, commands: [validCommand] }, changed: false });
  });

  it("defaults a missing pinned flag and reports a change", () => {
    const withoutPinned: Record<string, unknown> = { ...validCommand };
    delete withoutPinned.pinned;
    const result = migrateCommandStore(store([withoutPinned]), defaults);
    expect(result).toMatchObject({ kind: "ok", changed: true });
    if (result.kind === "ok") expect(result.store.commands[0].pinned).toBe(false);
  });

  it("drops invalid entries and reports a change", () => {
    const result = migrateCommandStore(store([validCommand, { name: 5 }, null]), defaults);
    expect(result).toMatchObject({ kind: "ok", changed: true });
    if (result.kind === "ok") expect(result.store.commands).toEqual([validCommand]);
  });
});

describe("normalizeCommand", () => {
  it("fills icon, output and model defaults", () => {
    const command = normalizeCommand({ id: "a", name: "A", prompt: "p", output: "bogus" }, defaults);
    expect(command).toMatchObject({ icon: "Stars", output: "window", model: "system", creativity: "normal" });
  });

  it("rejects entries without id, name or prompt", () => {
    expect(normalizeCommand({ name: "A", prompt: "p" }, defaults)).toBeUndefined();
    expect(normalizeCommand({ id: "a", name: "", prompt: "p" }, defaults)).toBeUndefined();
    expect(normalizeCommand({ id: "a", name: "A", prompt: 3 }, defaults)).toBeUndefined();
  });
});
