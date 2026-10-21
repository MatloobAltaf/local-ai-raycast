import { describe, expect, it } from "vitest";
import { conversationToText, turnToMarkdown } from "./format";
import type { ChatTurn } from "./operations";

const NOW = "2026-01-01T00:00:00.000Z";

function turn(question: string, answer?: string, imagePath?: string): ChatTurn {
  return {
    user: { id: "u", role: "user", content: question, createdAt: NOW, ...(imagePath ? { imagePath } : {}) },
    ...(answer === undefined ? {} : { assistant: { id: "a", role: "assistant", content: answer, createdAt: NOW } }),
  };
}

describe("turnToMarkdown", () => {
  it("renders the question as a blockquote above the answer", () => {
    expect(turnToMarkdown(turn("a\nb", "hi"))).toBe("**You**\n\n> a\n> b\n\n**Local AI**\n\nhi");
  });

  it("shows a thinking placeholder only while pending, otherwise a no-answer note", () => {
    expect(turnToMarkdown(turn("q"), "", true)).toContain("_Thinking..._");
    expect(turnToMarkdown(turn("q"))).toContain("_No answer._");
  });

  it("prefers the streaming text over the stored answer", () => {
    expect(turnToMarkdown(turn("q", "old"), "partial", true)).toContain("partial");
  });

  it("embeds the attached image as an encoded file URL", () => {
    expect(turnToMarkdown(turn("q", "a", "/tmp/my pic.png"))).toContain("![Attached image](file:///tmp/my%20pic.png)");
  });
});

describe("conversationToText", () => {
  it("joins turns oldest first in the You and Local AI format", () => {
    expect(conversationToText([turn("q1", "a1"), turn("q2")])).toBe(
      "**You**\n\nq1\n\n**Local AI**\n\na1\n\n---\n\n**You**\n\nq2\n\n**Local AI**\n\n_No answer._",
    );
  });
});
