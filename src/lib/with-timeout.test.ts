import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "./with-timeout";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the value and clears the timer when the promise settles first", async () => {
    await expect(withTimeout(Promise.resolve("done"), 1000)).resolves.toBe("done");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects and clears the timer when the timeout elapses first", async () => {
    const pending = withTimeout(new Promise<string>(() => {}), 1000);
    const assertion = expect(pending).rejects.toThrow("Timed out after 1000 ms");
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
