export type VersionedLoad<S> =
  | { kind: "ok"; store: S; changed: boolean }
  | { kind: "empty" }
  | { kind: "corrupt"; raw: string }
  | { kind: "newer"; version: number };

export interface VersionedStoreSpec<S> {
  version: number;
  parse: (value: Record<string, unknown>) => { store: S; changed: boolean } | undefined;
}

export function loadVersionedStore<S>(raw: string | undefined, spec: VersionedStoreSpec<S>): VersionedLoad<S> {
  if (raw === undefined) return { kind: "empty" };
  const value = parseJson(raw);
  if (!isRecord(value) || !Number.isInteger(value.version)) return { kind: "corrupt", raw };
  const version = value.version as number;
  if (version > spec.version) return { kind: "newer", version };
  if (version < 1) return { kind: "corrupt", raw };
  const parsed = spec.parse(value);
  if (!parsed) return { kind: "corrupt", raw };
  return { kind: "ok", store: parsed.store, changed: parsed.changed || version !== spec.version };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
