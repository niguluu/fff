// Central registry of child processes spawned by the agent.
//
// Every command launched through the bash tool registers itself here so that
// on exit (clean quit, Ctrl+C, SIGTERM) we can kill the whole tree instead of
// leaving orphaned processes attached to the user's terminal.

import type { ChildProcess } from "node:child_process";
import { logger } from "./logger.js";

const children = new Set<ChildProcess>();

export function registerChild(child: ChildProcess): void {
  children.add(child);
  child.once("exit", () => children.delete(child));
}

export function unregisterChild(child: ChildProcess): void {
  children.delete(child);
}

/**
 * Kill a single child and its process group. We spawn with `detached: true`,
 * so the negative PID targets the whole group (the command plus anything it
 * forked, e.g. a dev server).
 */
export function killChild(child: ChildProcess, signal: NodeJS.Signals = "SIGTERM"): void {
  if (child.killed || child.pid === undefined) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      /* already gone */
    }
  }
}

/** Kill every tracked child process group. Used during shutdown. */
export function killAllChildren(): void {
  if (children.size === 0) return;
  logger.info("process-registry", `killing ${children.size} child process(es)`);
  for (const child of [...children]) {
    killChild(child, "SIGTERM");
  }
  // Escalate to SIGKILL shortly after for anything that ignored SIGTERM.
  setTimeout(() => {
    for (const child of [...children]) {
      killChild(child, "SIGKILL");
    }
  }, 300).unref?.();
  children.clear();
}

export function activeChildCount(): number {
  return children.size;
}
