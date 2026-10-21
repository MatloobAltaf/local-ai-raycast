import { LocalStorage } from "@raycast/api";
import { migrateChatStore } from "../lib/chats/schema";
import { CHAT_STORE_VERSION, CHATS_BACKUP_KEY, CHATS_STORAGE_KEY, type Chat } from "../lib/chats/types";

export interface LoadedChats {
  chats: Chat[];
  readOnly: boolean;
  notice?: string;
}

const CORRUPT_NOTICE = "Saved chats could not be read. A backup was kept and the chat list was reset.";
const NEWER_NOTICE = "These chats were saved by a newer version of Local AI. Update the extension to edit them.";

export async function loadChats(): Promise<LoadedChats> {
  const result = migrateChatStore(await LocalStorage.getItem<string>(CHATS_STORAGE_KEY));

  switch (result.kind) {
    case "ok":
      if (result.changed) await saveChats(result.store.chats);
      return { chats: result.store.chats, readOnly: false };
    case "empty":
      return { chats: [], readOnly: false };
    case "corrupt":
      await LocalStorage.setItem(CHATS_BACKUP_KEY, result.raw);
      await saveChats([]);
      return { chats: [], readOnly: false, notice: CORRUPT_NOTICE };
    case "newer":
      return { chats: [], readOnly: true, notice: NEWER_NOTICE };
  }
}

export async function saveChats(chats: Chat[]): Promise<void> {
  const current = migrateChatStore(await LocalStorage.getItem<string>(CHATS_STORAGE_KEY));
  if (current.kind === "newer") throw new Error(NEWER_NOTICE);
  await LocalStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify({ version: CHAT_STORE_VERSION, chats }));
}
