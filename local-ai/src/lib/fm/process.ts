import { spawn } from "node:child_process";
import { stripAnsi } from "./ansi";
import { FM_PATH } from "./constants";
import { mapFmFailure } from "./errors";

export interface RunFmOptions {
  stdin?: string;
  signal?: AbortSignal;
  timeoutMs: number;
  onStdout?: (accumulated: string) => void;
  binaryPath?: string;
}

export interface RunFmResult {
  stdout: string;
  stderr: string;
}

export interface ProbeResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  spawnErrorCode?: string;
}

interface RawRun extends ProbeResult {
  timedOut: boolean;
  aborted: boolean;
}

export async function runFm(args: string[], options: RunFmOptions): Promise<RunFmResult> {
  const run = await rawRun(args, options);
  if (run.timedOut || run.aborted || run.spawnErrorCode !== undefined || run.exitCode !== 0) {
    throw mapFmFailure({
      exitCode: run.exitCode,
      stderr: stripAnsi(run.stderr),
      spawnErrorCode: run.spawnErrorCode,
      timedOut: run.timedOut,
      aborted: run.aborted,
      timeoutMs: options.timeoutMs,
      model: modelFromArgs(args),
    });
  }
  return { stdout: stripAnsi(run.stdout), stderr: stripAnsi(run.stderr) };
}

export async function probeFm(args: string[], timeoutMs: number, binaryPath?: string): Promise<ProbeResult> {
  const run = await rawRun(args, { timeoutMs, binaryPath });
  return {
    exitCode: run.exitCode,
    stdout: stripAnsi(run.stdout),
    stderr: stripAnsi(run.stderr),
    ...(run.spawnErrorCode !== undefined && { spawnErrorCode: run.spawnErrorCode }),
  };
}

function modelFromArgs(args: string[]): string | undefined {
  const index = args.indexOf("--model");
  return index === -1 ? undefined : args[index + 1];
}

function rawRun(args: string[], options: RunFmOptions): Promise<RawRun> {
  return new Promise((resolve) => {
    const result: RawRun = { exitCode: null, stdout: "", stderr: "", timedOut: false, aborted: false };
    let settled = false;

    const child = spawn(options.binaryPath ?? FM_PATH, args, {
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };

    const terminate = () => {
      child.kill("SIGTERM");
    };

    const onAbort = () => {
      result.aborted = true;
      terminate();
    };

    const timer = setTimeout(() => {
      result.timedOut = true;
      terminate();
    }, options.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      result.stdout += chunk;
      options.onStdout?.(stripAnsi(result.stdout));
    });
    child.stderr.on("data", (chunk: string) => {
      result.stderr += chunk;
    });
    child.stdin.on("error", () => {});
    child.on("error", (error: NodeJS.ErrnoException) => {
      result.spawnErrorCode = error.code ?? "UNKNOWN";
      finish();
    });
    child.on("close", (code) => {
      result.exitCode = code;
      finish();
    });

    if (options.signal?.aborted) onAbort();
    else options.signal?.addEventListener("abort", onAbort, { once: true });

    child.stdin.end(options.stdin ?? "");
  });
}
