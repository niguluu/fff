/**
 * Shared utilities and constants for tool renderers.
 */
import type { Theme } from "./theme.js";
import { formatDuration, pluralize, replaceTabs, truncateToWidth } from "./text-utils.js";

export { formatDuration, pluralize, replaceTabs, truncateToWidth };

export const EXPAND_HINT = "(Ctrl+O for more)";

export type ToolUIStatus = "success" | "error" | "warning" | "info" | "pending" | "running" | "aborted";
export type ToolUIColor = "success" | "error" | "warning" | "accent" | "muted";

export function formatStatusIcon(status: ToolUIStatus, theme: Theme, spinnerFrame?: number): string {
  switch (status) {
    case "success":
      return theme.styledSymbol("status.success", "success");
    case "error":
      return theme.styledSymbol("status.error", "error");
    case "warning":
      return theme.styledSymbol("status.warning", "warning");
    case "info":
      return theme.styledSymbol("status.info", "accent");
    case "pending":
      return theme.styledSymbol("status.pending", "muted");
    case "running":
      if (spinnerFrame !== undefined) {
        const frames = theme.spinnerFrames;
        return frames[spinnerFrame % frames.length]!;
      }
      return theme.styledSymbol("status.running", "accent");
    case "aborted":
      return theme.styledSymbol("status.aborted", "error");
  }
}

export function formatExpandHint(theme: Theme, expanded?: boolean, hasMore?: boolean): string {
  if (expanded) return "";
  if (hasMore === false) return "";
  return theme.fg("dim", wrapBrackets(EXPAND_HINT, theme));
}

export function formatMoreItems(remaining: number, itemType: string): string {
  const safeRemaining = Number.isFinite(remaining) ? remaining : 0;
  return `… ${safeRemaining} more ${pluralize(itemType, safeRemaining)}`;
}

export function wrapBrackets(text: string, theme: Theme): string {
  return `${theme.format.bracketLeft}${text}${theme.format.bracketRight}`;
}

export function formatTitle(label: string, theme: Theme, options?: { bold?: boolean }): string {
  const content = options?.bold === false ? label : theme.bold(label);
  return theme.fg("toolTitle", content);
}
