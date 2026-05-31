/**
 * Shared helpers for tool-rendered UI components.
 */
import type { Theme, ThemeBg } from "./theme.js";
import type { State } from "./types.js";
import { visibleWidth, padding } from "./text-utils.js";

/** Simple string hash for cache keys (replaces Bun.hash.xxHash64). */
export function hashString(input: string): bigint {
  let h = 0n;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31n + BigInt(input.charCodeAt(i))) & 0xffffffffffffffffn;
  }
  return h;
}

/** Build a cache key from options. */
export function buildCacheKey(parts: Array<string | number | boolean | undefined>): bigint {
  let h = 0n;
  for (const part of parts) {
    if (part === undefined) {
      h = (h * 31n + 0xffn) & 0xffffffffffffffffn;
    } else if (typeof part === "boolean") {
      h = (h * 31n + (part ? 1n : 0n)) & 0xffffffffffffffffn;
    } else if (typeof part === "number") {
      h = (h * 31n + BigInt(part)) & 0xffffffffffffffffn;
    } else {
      h = (h * 31n + hashString(part)) & 0xffffffffffffffffn;
    }
  }
  return h;
}

export interface RenderCache {
  key: bigint;
  lines: string[];
}

export function buildTreePrefix(ancestors: boolean[], theme: Theme): string {
  return ancestors.map((hasNext) => (hasNext ? `${theme.tree.vertical}  ` : "   ")).join("");
}

export function getTreeBranch(isLast: boolean, theme: Theme): string {
  return isLast ? theme.tree.last : theme.tree.branch;
}

export function getTreeContinuePrefix(isLast: boolean, theme: Theme): string {
  return isLast ? "   " : `${theme.tree.vertical}  `;
}

export function padToWidth(text: string, width: number, bgFn?: (s: string) => string): string {
  if (width <= 0) return bgFn ? bgFn(text) : text;
  const paddingNeeded = Math.max(0, width - visibleWidth(text));
  const padded = paddingNeeded > 0 ? text + padding(paddingNeeded) : text;
  return bgFn ? bgFn(padded) : padded;
}

export function getStateBgColor(state: State): ThemeBg {
  if (state === "success") return "toolSuccessBg";
  if (state === "error") return "toolErrorBg";
  return "toolPendingBg";
}
