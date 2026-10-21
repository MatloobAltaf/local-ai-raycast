import { describe, expect, it } from "vitest";
import {
  finalizeReplacement,
  finalizeWindowText,
  looksLikeRefusal,
  stripPreamble,
  stripSpeakerLabel,
  stripWrappingQuotes,
} from "./output";

describe("stripPreamble", () => {
  it("removes a lead-in line", () => {
    expect(stripPreamble("Here is the rewritten text:\n\nHello there.")).toBe("Hello there.");
    expect(stripPreamble("Sure! Here's a more professional version:\nHello.")).toBe("Hello.");
    expect(stripPreamble("Here’s the rewritten text:\nHi.")).toBe("Hi.");
  });

  it("removes a same-line label", () => {
    expect(stripPreamble("Rewritten text: Hello.")).toBe("Hello.");
  });

  it("leaves non-preamble text alone", () => {
    expect(stripPreamble("Here is how it works:\nStep 1")).toBe("Here is how it works:\nStep 1");
    expect(stripPreamble("Hello.\nHere is the text:")).toBe("Hello.\nHere is the text:");
  });
});

describe("stripWrappingQuotes", () => {
  it("removes quotes the model added", () => {
    expect(stripWrappingQuotes('"Hello there."', "hey there")).toBe("Hello there.");
    expect(stripWrappingQuotes("“Hello there.”", "hey there")).toBe("Hello there.");
  });

  it("keeps quotes when the input was quoted", () => {
    expect(stripWrappingQuotes('"Hello there."', '"hey there"')).toBe('"Hello there."');
  });
});

describe("looksLikeRefusal", () => {
  it("detects refusals", () => {
    expect(looksLikeRefusal("I'm sorry, but I can't help with that.")).toBe(true);
    expect(looksLikeRefusal("I’m sorry, but I can’t help with that.")).toBe(true);
    expect(looksLikeRefusal("I cannot assist with this request.")).toBe(true);
  });

  it("ignores legitimate rewrites", () => {
    expect(looksLikeRefusal("I'm sorry, but I can't make it tomorrow.")).toBe(false);
    expect(looksLikeRefusal("I'm unable to do Friday.")).toBe(false);
    expect(looksLikeRefusal("Thanks for the update.")).toBe(false);
  });
});

describe("stripSpeakerLabel", () => {
  it("removes an assistant label", () => {
    expect(stripSpeakerLabel("Assistant: Hi")).toBe("Hi");
  });
});

describe("finalizeReplacement", () => {
  it("cleans a replacement", () => {
    expect(finalizeReplacement("Here is the rewritten text:\nHi there.\n", "hey there")).toEqual({
      ok: true,
      text: "Hi there.",
    });
  });

  it("keeps the input trailing newline", () => {
    expect(finalizeReplacement("Hi there.\n", "hey there\n")).toEqual({ ok: true, text: "Hi there.\n" });
  });

  it("reports empty output", () => {
    expect(finalizeReplacement("  \n", "x")).toEqual({ ok: false, reason: "empty", text: "" });
  });

  it("reports refusals", () => {
    expect(finalizeReplacement("I'm sorry, but I can't help with that.", "x")).toMatchObject({
      ok: false,
      reason: "refusal",
    });
  });
});

describe("finalizeWindowText", () => {
  it("strips the preamble and trims", () => {
    expect(finalizeWindowText("Here is the summary:\nShort.\n")).toBe("Short.");
  });
});
