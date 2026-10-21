import { Clipboard, getSelectedText } from "@raycast/api";
import type { RunInput } from "../lib/launch-context";
import { resolveInput } from "../lib/run-request";

export async function readSelection(): Promise<string | undefined> {
  try {
    return await getSelectedText();
  } catch {
    return undefined;
  }
}

export async function captureInput(): Promise<RunInput | undefined> {
  const selection = await readSelection();
  if (selection?.trim()) return resolveInput(selection, undefined);
  return resolveInput(selection, await Clipboard.readText());
}
