import { LocalStorage } from "@raycast/api";
import { migrateCommandStore } from "../lib/commands/schema";
import { starterCommands } from "../lib/commands/starters";
import {
  COMMAND_STORE_VERSION,
  COMMANDS_BACKUP_KEY,
  COMMANDS_STORAGE_KEY,
  type AiCommand,
  type CommandDefaults,
} from "../lib/commands/types";
import { getSettings } from "./settings";

export interface LoadedCommands {
  commands: AiCommand[];
  readOnly: boolean;
  notice?: string;
}

const CORRUPT_NOTICE = "Saved commands could not be read. A backup was kept and the starter commands were restored.";
const NEWER_NOTICE = "These commands were saved by a newer version of Local AI. Update the extension to edit them.";

export async function loadCommands(): Promise<LoadedCommands> {
  const raw = await LocalStorage.getItem<string>(COMMANDS_STORAGE_KEY);
  const defaults = commandDefaults();
  const result = migrateCommandStore(raw, defaults);

  switch (result.kind) {
    case "ok":
      if (result.changed) await saveCommands(result.store.commands);
      return { commands: result.store.commands, readOnly: false };
    case "empty":
      return { commands: await saveStarters(defaults), readOnly: false };
    case "corrupt":
      await LocalStorage.setItem(COMMANDS_BACKUP_KEY, result.raw);
      return { commands: await saveStarters(defaults), readOnly: false, notice: CORRUPT_NOTICE };
    case "newer":
      return { commands: [], readOnly: true, notice: NEWER_NOTICE };
  }
}

export async function saveCommands(commands: AiCommand[]): Promise<void> {
  const current = migrateCommandStore(await LocalStorage.getItem<string>(COMMANDS_STORAGE_KEY), commandDefaults());
  if (current.kind === "newer") throw new Error(NEWER_NOTICE);
  await LocalStorage.setItem(COMMANDS_STORAGE_KEY, JSON.stringify({ version: COMMAND_STORE_VERSION, commands }));
}

async function saveStarters(defaults: CommandDefaults): Promise<AiCommand[]> {
  const starters = starterCommands(new Date().toISOString(), defaults);
  await saveCommands(starters);
  return starters;
}

function commandDefaults(): CommandDefaults {
  const settings = getSettings();
  return { model: settings.defaultModel, creativity: settings.defaultCreativity };
}
