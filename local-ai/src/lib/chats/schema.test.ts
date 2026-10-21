import { describe, expect, it } from "vitest";
import { migrateChatStore } from "./schema";

const message = { id: "m1", role: "user", content: "Hi", createdAt: "2026-01-02T00:00:00.000Z" };
const chat = {
  id: "c1",
  title: "Hi",
  instructions: "",
  messages: [message],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("migrateChatStore", () => {
  it("classifies empty, corrupt and newer data", () => {
    expect(migrateChatStore(undefined)).toEqual({ kind: "empty" });
    expect(migrateChatStore("not json")).toEqual({ kind: "corrupt", raw: "not json" });
    expect(migrateChatStore('{"version":2,"chats":[]}')).toEqual({ kind: "newer", version: 2 });
  });

  it("leaves a complete store unchanged", () => {
    const result = migrateChatStore(JSON.stringify({ version: 1, chats: [chat] }));
    expect(result).toEqual({ kind: "ok", store: { version: 1, chats: [chat] }, changed: false });
  });

  it("gives a message missing createdAt the chat's createdAt", () => {
    const bare: Record<string, unknown> = { ...message };
    delete bare.createdAt;
    const result = migrateChatStore(JSON.stringify({ version: 1, chats: [{ ...chat, messages: [bare] }] }));
    expect(result).toMatchObject({ kind: "ok", changed: true });
    if (result.kind === "ok") expect(result.store.chats[0].messages[0].createdAt).toBe(chat.createdAt);
  });
});
