import type { ChatTurn } from "./operations";

export const DEFAULT_CHAT_INSTRUCTIONS =
  "You are a helpful assistant running privately on the user's Mac. Answer concisely in Markdown.";

const LAST_MESSAGE_RULE = " Reply only to the last message from User.";

export function buildChatInstructions(custom: string): string {
  return (custom.trim() || DEFAULT_CHAT_INSTRUCTIONS) + LAST_MESSAGE_RULE;
}

export function buildChatStdin(history: ChatTurn[], newMessage: string): string {
  if (history.length === 0) return newMessage;
  const lines = history.flatMap((turn) => [
    `User: ${turn.user.content}`,
    ...(turn.assistant ? [`Assistant: ${turn.assistant.content}`] : []),
  ]);
  return `Conversation so far:\n${lines.join("\n")}\n\nNew message from User:\n${newMessage}`;
}
