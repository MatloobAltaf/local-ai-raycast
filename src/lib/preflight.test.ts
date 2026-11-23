import { describe, expect, it } from "vitest";
import {
  DEVICE_NOT_ELIGIBLE_MESSAGE,
  MODEL_NOT_READY_MESSAGE,
  MODEL_UNAVAILABLE_MESSAGE,
  UNAVAILABLE_MESSAGE,
} from "./fm/errors";
import {
  canOpenSettingsFor,
  evaluatePreflight,
  isPreflightCacheFresh,
  parseModelAvailability,
  type ModelUnavailableReason,
} from "./preflight";

const UNDETERMINED_MESSAGE = "Could not confirm Apple Intelligence. Local AI will tell you if a command cannot run.";

const licenseOk = { exitCode: 0, stdout: "Agreed to license FM1 version 1.0 on 21 Oct 2026 at 19:07.\n", stderr: "" };
const availableOk = { status: "available" } as const;

function statuses(result: ReturnType<typeof evaluatePreflight>) {
  return result.checks.map((check) => check.status);
}

describe("evaluatePreflight", () => {
  it("fails on a missing binary and skips the rest", () => {
    const result = evaluatePreflight({ binaryExists: false });
    expect(result.ok).toBe(false);
    expect(result.firstFailure).toBe("binary");
    expect(statuses(result)).toEqual(["failed", "skipped", "skipped"]);
  });

  it("passes when every probe succeeds", () => {
    const result = evaluatePreflight({ binaryExists: true, license: licenseOk, available: availableOk });
    expect(result.ok).toBe(true);
    expect(result.firstFailure).toBeUndefined();
    expect(statuses(result)).toEqual(["ok", "ok", "ok"]);
  });

  it("fails on the license exit code and skips availability", () => {
    const result = evaluatePreflight({ binaryExists: true, license: { exitCode: 69, stdout: "", stderr: "" } });
    expect(result.firstFailure).toBe("license");
    expect(statuses(result)).toEqual(["ok", "failed", "skipped"]);
  });

  it("fails when the license output does not start with Agreed", () => {
    const result = evaluatePreflight({
      binaryExists: true,
      license: { exitCode: 0, stdout: "You have not agreed", stderr: "" },
    });
    expect(result.checks[1].status).toBe("failed");
  });

  it.each<[ModelUnavailableReason, string]>([
    ["appleIntelligenceNotEnabled", UNAVAILABLE_MESSAGE],
    ["modelNotReady", MODEL_NOT_READY_MESSAGE],
    ["deviceNotEligible", DEVICE_NOT_ELIGIBLE_MESSAGE],
    ["unknown", MODEL_UNAVAILABLE_MESSAGE],
  ])("fails with the matching message and reason when the model is unavailable because of %s", (reason, message) => {
    const result = evaluatePreflight({
      binaryExists: true,
      license: licenseOk,
      available: { status: "unavailable", reason },
    });
    expect(result.firstFailure).toBe("available");
    expect(statuses(result)).toEqual(["ok", "ok", "failed"]);
    expect(result.checks[2].message).toBe(message);
    expect(result.checks[2].reason).toBe(reason);
  });

  it("passes with the undetermined message when availability could not be determined", () => {
    const result = evaluatePreflight({ binaryExists: true, license: licenseOk, available: { status: "undetermined" } });
    expect(result.ok).toBe(true);
    expect(statuses(result)).toEqual(["ok", "ok", "ok"]);
    expect(result.checks[2].message).toBe(UNDETERMINED_MESSAGE);
    expect(result.checks[2].reason).toBeUndefined();
  });

  it("fails availability without a reason when the probe is missing", () => {
    const result = evaluatePreflight({ binaryExists: true, license: licenseOk });
    expect(result.firstFailure).toBe("available");
    expect(result.checks[2].message).toBe(MODEL_UNAVAILABLE_MESSAGE);
    expect(result.checks[2].reason).toBeUndefined();
  });
});

describe("parseModelAvailability", () => {
  it("accepts an available status", () => {
    expect(parseModelAvailability({ status: "available" })).toEqual({ status: "available" });
  });

  it.each<ModelUnavailableReason>(["appleIntelligenceNotEnabled", "deviceNotEligible", "modelNotReady", "unknown"])(
    "accepts an unavailable status with the %s reason",
    (reason) => {
      expect(parseModelAvailability({ status: "unavailable", reason })).toEqual({ status: "unavailable", reason });
    },
  );

  it.each<[string, unknown]>([
    ["an unknown status", { status: "sleeping" }],
    ["an unrecognised reason", { status: "unavailable", reason: "helperFailed" }],
    ["a missing reason", { status: "unavailable" }],
    ["a string", "available"],
    ["null", null],
    ["an array", [{ status: "available" }]],
  ])("is undetermined for %s", (_label, raw) => {
    expect(parseModelAvailability(raw)).toEqual({ status: "undetermined" });
  });
});

describe("canOpenSettingsFor", () => {
  it.each<[ModelUnavailableReason | undefined, boolean]>([
    ["appleIntelligenceNotEnabled", true],
    ["unknown", true],
    [undefined, true],
    ["deviceNotEligible", false],
    ["modelNotReady", false],
  ])("for %s returns %s", (reason, expected) => {
    expect(canOpenSettingsFor(reason)).toBe(expected);
  });
});

describe("isPreflightCacheFresh", () => {
  it("expires at the TTL boundary", () => {
    expect(isPreflightCacheFresh(0, 299_999)).toBe(true);
    expect(isPreflightCacheFresh(0, 300_000)).toBe(false);
  });
});
