import { describe, expect, it } from "vitest";
import { FmError, type FmErrorKind } from "./errors";
import { errorBlockMarkdown, explainFmError } from "./explain";

describe("explainFmError", () => {
  it("explains the context window for overflow", () => {
    const { title, explanation } = explainFmError(new FmError("contextOverflow", "Text is too long"));
    expect(title).toBe("Too long for the on-device model");
    expect(explanation).toContain("4,096 tokens");
    expect(explanation).toContain("new chat");
  });

  it("keeps the timeout message with its seconds", () => {
    const message = "The on-device model did not finish within 60 seconds. Try shorter text.";
    expect(explainFmError(new FmError("timeout", message))).toEqual({ title: "Timed out", explanation: message });
  });

  it("explains the safety filter", () => {
    const { explanation } = explainFmError(new FmError("guardrail", "declined"));
    expect(explanation).toContain("safety filter");
    expect(explanation).toContain("Rephrasing");
  });

  it("reports a user stop", () => {
    expect(explainFmError(new FmError("aborted", "Cancelled"))).toEqual({
      title: "Stopped",
      explanation: "You stopped the answer.",
    });
  });

  it.each<FmErrorKind>(["notInstalled", "license", "unavailable"])("points %s to Check Setup", (kind) => {
    expect(explainFmError(new FmError(kind, "setup message"))).toEqual({
      title: "setup message",
      explanation: "Open Check Setup to fix this.",
    });
  });

  it("uses the existing message for an invalid model", () => {
    const result = explainFmError(new FmError("invalidModel", 'Model "x" is not available'));
    expect(result.title).toBe('Model "x" is not available');
    expect(result.explanation).toBe("The on-device model returned an error.");
  });

  it("appends the first stderr line for an invalid model", () => {
    const result = explainFmError(new FmError("invalidModel", "Bad model", "Error: 'pcc' is invalid\nmore"));
    expect(result.explanation).toBe("The on-device model returned an error. Error: 'pcc' is invalid");
  });

  it("appends the first stderr line for unknown errors", () => {
    expect(explainFmError(new FmError("unknown", "boom", "line one\nline two")).explanation).toBe(
      "The on-device model returned an error. line one",
    );
    expect(explainFmError(new FmError("unknown", "boom")).explanation).toBe("The on-device model returned an error.");
  });
});

describe("errorBlockMarkdown", () => {
  it("renders a blockquote with title and explanation", () => {
    expect(errorBlockMarkdown("Timed out", "Too slow.")).toBe("> **Stopped: Timed out**\n> Too slow.");
  });

  it("does not repeat Stopped and omits a missing explanation", () => {
    expect(errorBlockMarkdown("Stopped")).toBe("> **Stopped**");
  });
});
