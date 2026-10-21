import { pathToFileURL } from "node:url";
import type { ChatTurn } from "./operations";

export const PENDING_ANSWER = "_Thinking..._";
export const EMPTY_ANSWER = "_No answer._";

function imageUrl(imagePath: string): string {
  return pathToFileURL(imagePath).href.replace(/\(/g, "%28").replace(/\)/g, "%29");
}

export function turnToMarkdown(turn: ChatTurn, answerOverride?: string, isPending = false): string {
  const quote = turn.user.content
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  const image = turn.user.imagePath ? `\n\n![Attached image](${imageUrl(turn.user.imagePath)})` : "";
  const answer = answerOverride ?? turn.assistant?.content;
  return `**You**\n\n${quote}${image}\n\n**Local AI**\n\n${answer || (isPending ? PENDING_ANSWER : EMPTY_ANSWER)}`;
}

export function conversationToText(turns: ChatTurn[]): string {
  return turns
    .map((turn) => `**You**\n\n${turn.user.content}\n\n**Local AI**\n\n${turn.assistant?.content || EMPTY_ANSWER}`)
    .join("\n\n---\n\n");
}
