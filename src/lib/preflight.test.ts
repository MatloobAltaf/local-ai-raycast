import { describe, expect, it } from "vitest";
import {
  DEVICE_NOT_ELIGIBLE_MESSAGE,
  MODEL_NOT_READY_MESSAGE,
  MODEL_UNAVAILABLE_MESSAGE,
  UNAVAILABLE_MESSAGE,
} from "./fm/errors";
import { evaluatePreflight, isPreflightCacheFresh, type ModelUnavailableReason } from "./preflight";

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
    ["helperFailed", MODEL_UNAVAILABLE_MESSAGE],
  ])("fails with the matching message when the model is unavailable because of %s", (reason, message) => {
    const result = evaluatePreflight({
      binaryExists: true,
      license: licenseOk,
      available: { status: "unavailable", reason },
    });
    expect(result.firstFailure).toBe("available");
    expect(statuses(result)).toEqual(["ok", "ok", "failed"]);
    expect(result.checks[2].message).toBe(message);
  });

  it("fails availability when the probe is missing", () => {
    const result = evaluatePreflight({ binaryExists: true, license: licenseOk });
    expect(result.firstFailure).toBe("available");
    expect(result.checks[2].message).toBe(MODEL_UNAVAILABLE_MESSAGE);
  });
});

describe("isPreflightCacheFresh", () => {
  it("expires at the TTL boundary", () => {
    expect(isPreflightCacheFresh(0, 299_999)).toBe(true);
    expect(isPreflightCacheFresh(0, 300_000)).toBe(false);
  });
});
