import { describe, expect, it } from "vitest";
import { FmError } from "./errors";
import { probeFm, runFm } from "./process";

async function rejection(promise: Promise<unknown>): Promise<FmError> {
  try {
    await promise;
  } catch (error) {
    return error as FmError;
  }
  throw new Error("expected rejection");
}

describe("runFm", () => {
  it("round-trips stdin untouched", async () => {
    const stdin = "héllo {clipboard} 😀 $(x)";
    const result = await runFm([], { binaryPath: "/bin/cat", stdin, timeoutMs: 5000 });
    expect(result.stdout).toBe(stdin);
  });

  it("passes args without a shell", async () => {
    const result = await runFm(["a b", "$(whoami)"], { binaryPath: "/bin/echo", timeoutMs: 5000 });
    expect(result.stdout).toBe("a b $(whoami)\n");
  });

  it("strips ANSI from stdout and onStdout", async () => {
    let last = "";
    const result = await runFm([], {
      binaryPath: "/bin/cat",
      stdin: "\x1b[1mbold\x1b[0m",
      timeoutMs: 5000,
      onStdout: (text) => {
        last = text;
      },
    });
    expect(result.stdout).toBe("bold");
    expect(last).toBe("bold");
  });

  it("closes stdin when none is given", async () => {
    const result = await runFm([], { binaryPath: "/bin/cat", timeoutMs: 5000 });
    expect(result.stdout).toBe("");
  });

  it("rejects with timeout", async () => {
    const error = await rejection(runFm(["5"], { binaryPath: "/bin/sleep", timeoutMs: 100 }));
    expect(error.kind).toBe("timeout");
  });

  it("rejects with aborted", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    const error = await rejection(
      runFm(["5"], { binaryPath: "/bin/sleep", timeoutMs: 5000, signal: controller.signal }),
    );
    expect(error.kind).toBe("aborted");
  });

  it("rejects an already aborted signal", async () => {
    const error = await rejection(
      runFm(["5"], { binaryPath: "/bin/sleep", timeoutMs: 5000, signal: AbortSignal.abort() }),
    );
    expect(error.kind).toBe("aborted");
  });

  it("rejects non-zero exit as unknown", async () => {
    const error = await rejection(runFm([], { binaryPath: "/usr/bin/false", timeoutMs: 5000 }));
    expect(error.kind).toBe("unknown");
  });

  it("rejects a missing binary as notInstalled", async () => {
    const error = await rejection(runFm([], { binaryPath: "/nonexistent/fm", timeoutMs: 5000 }));
    expect(error.kind).toBe("notInstalled");
  });
});

describe("probeFm", () => {
  it("resolves with the spawn error code instead of rejecting", async () => {
    const result = await probeFm([], 1000, "/nonexistent/fm");
    expect(result).toMatchObject({ exitCode: null, spawnErrorCode: "ENOENT" });
  });
});
