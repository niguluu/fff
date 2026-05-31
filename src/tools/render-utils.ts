/**
 * Slim subset of the upstream tool-renderer utilities, providing only the
 * formatting helpers the shared TUI components require.
 */
import type { Theme } from "../modes/theme/theme";

export { replaceTabs } from "@oh-my-pi/pi-tui";

export type ToolUIStatus = "success" | "error" | "warning" | "info" | "pending" | "running" | "aborted";
export type ToolUIColor = "success" | "error" | "warning" | "accent" | "muted";

/** Standard expand hint text. */
export const EXPAND_HINT = "(Ctrl+O for more)";

/** Naive English pluralization sufficient for short UI item labels. */
export function pluralize(word: string, count: number): string {
	if (count === 1) return word;
	if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
	if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
	return `${word}s`;
}

/** Wrap text in the theme's bracket glyphs. */
export function wrapBrackets(text: string, theme: Theme): string {
	return `${theme.format.bracketLeft}${text}${theme.format.bracketRight}`;
}

/**
 * Format a duration in milliseconds into a compact human-readable string.
 */
export function formatDuration(ms: number): string {
	if (!Number.isFinite(ms) || ms < 0) return "0ms";
	if (ms < 1000) return `${Math.round(ms)}ms`;
	const totalSeconds = ms / 1000;
	if (totalSeconds < 60) return `${totalSeconds.toFixed(totalSeconds < 10 ? 1 : 0)}s`;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = Math.round(totalSeconds % 60);
	if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const remMinutes = minutes % 60;
	return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

/**
 * Get the appropriate status icon with color for a given state.
 */
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
		case "running": {
			if (spinnerFrame !== undefined) {
				const frames = theme.spinnerFrames;
				return frames[spinnerFrame % frames.length]!;
			}
			return theme.styledSymbol("status.running", "accent");
		}
		case "aborted":
			return theme.styledSymbol("status.aborted", "error");
	}
}

/**
 * Format the expand hint with proper theming.
 * Returns empty string if already expanded or there is nothing more to show.
 */
export function formatExpandHint(theme: Theme, expanded?: boolean, hasMore?: boolean): string {
	if (expanded) return "";
	if (hasMore === false) return "";
	return theme.fg("dim", wrapBrackets(EXPAND_HINT, theme));
}

/**
 * Build a "more items" suffix line for truncated lists.
 */
export function formatMoreItems(remaining: number, itemType: string): string {
	const safeRemaining = Number.isFinite(remaining) ? remaining : 0;
	return `… ${safeRemaining} more ${pluralize(itemType, safeRemaining)}`;
}
