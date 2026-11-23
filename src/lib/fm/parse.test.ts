import { describe, expect, it } from "vitest";
import { FmError } from "./errors";
import { parseTokenCount } from "./parse";

describe("parseTokenCount", () => {
  it("parses a bare integer", () => {
    expect(parseTokenCount("9\n")).toBe(9);
  });

  it("parses a labelled count", () => {
    expect(parseTokenCount("Token count: 412")).toBe(412);
  });

  it("throws an unknown FmError when no integer is present", () => {
    expect(() => parseTokenCount("")).toThrow(FmError);
    try {
      parseTokenCount("");
    } catch (error) {
      expect((error as FmError).kind).toBe("unknown");
    }
  });
});
