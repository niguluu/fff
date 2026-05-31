/**
 * Slim theme adapter for the ported TUI components.
 *
 * Provides the subset of the upstream `Theme` surface that the shared TUI
 * renderers (`output-block`, `code-cell`, `file-list`, `tree-list`,
 * `status-line`) depend on, backed by truecolor ANSI escapes derived from the
 * project's gruvbox palette.
 */
import {
	GRUVBOX_BG1,
	GRUVBOX_BG3,
	GRUVBOX_BLUE,
	GRUVBOX_FG,
	GRUVBOX_FG_DIM,
	GRUVBOX_GREEN,
	GRUVBOX_RED,
	GRUVBOX_YELLOW,
} from "../../core/config";
import type { MarkdownTheme } from "../../shims/pi-tui";
import { hexToRgb } from "../../utils/color";

/** Foreground color slots referenced by the TUI components. */
export type ThemeColor =
	| "accent"
	| "muted"
	| "dim"
	| "toolTitle"
	| "toolOutput"
	| "error"
	| "warning"
	| "success"
	| "borderMuted";

/** Background color slots referenced by the TUI components. */
export type ThemeBg = "toolSuccessBg" | "toolErrorBg" | "toolPendingBg";

/** Symbol keys referenced by the TUI components and render utilities. */
export type SymbolKey =
	| "status.success"
	| "status.error"
	| "status.warning"
	| "status.info"
	| "status.pending"
	| "status.running"
	| "status.aborted";

const FG_HEX: Record<ThemeColor, string> = {
	accent: GRUVBOX_BLUE,
	muted: GRUVBOX_FG_DIM,
	dim: GRUVBOX_BG3,
	toolTitle: GRUVBOX_YELLOW,
	toolOutput: GRUVBOX_FG,
	error: GRUVBOX_RED,
	warning: GRUVBOX_YELLOW,
	success: GRUVBOX_GREEN,
	borderMuted: GRUVBOX_BG1,
};

const BG_HEX: Record<ThemeBg, string> = {
	toolSuccessBg: "#1e2a17",
	toolErrorBg: "#2d1b1b",
	toolPendingBg: "#2a2a1e",
};

const SYMBOLS: Record<SymbolKey, string> = {
	"status.success": "✔",
	"status.error": "✘",
	"status.warning": "⚠",
	"status.info": "ⓘ",
	"status.pending": "⏳",
	"status.running": "⟳",
	"status.aborted": "⏹",
};

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function fgAnsi(hex: string): string {
	const { r, g, b } = hexToRgb(hex);
	return `\x1b[38;2;${r};${g};${b}m`;
}

function bgAnsi(hex: string): string {
	const { r, g, b } = hexToRgb(hex);
	return `\x1b[48;2;${r};${g};${b}m`;
}

/** Language icon lookup, keyed by normalized language name. */
const LANG_ICONS: Record<string, string> = {
	typescript: "🟦",
	javascript: "🟨",
	tsx: "🟦",
	jsx: "🟨",
	python: "🐍",
	rust: "🦀",
	go: "🐹",
	java: "☕",
	c: "Ⓒ",
	cpp: "➕",
	csharp: "♯",
	ruby: "💎",
	php: "🐘",
	swift: "🕊",
	kotlin: "🅺",
	shell: "💻",
	bash: "💻",
	html: "🌐",
	css: "🎨",
	json: "🔧",
	yaml: "🔧",
	markdown: "📝",
};

const LANG_DEFAULT_ICON = "⌘";

/** Map a file path to a language name based on its extension. */
export function getLanguageFromPath(filePath: string): string | undefined {
	const ext = filePath.slice(filePath.lastIndexOf(".") + 1).toLowerCase();
	const map: Record<string, string> = {
		ts: "typescript",
		tsx: "tsx",
		js: "javascript",
		jsx: "jsx",
		mjs: "javascript",
		cjs: "javascript",
		py: "python",
		rs: "rust",
		go: "go",
		java: "java",
		c: "c",
		h: "c",
		cpp: "cpp",
		cc: "cpp",
		hpp: "cpp",
		cs: "csharp",
		rb: "ruby",
		php: "php",
		swift: "swift",
		kt: "kotlin",
		kts: "kotlin",
		sh: "shell",
		bash: "bash",
		html: "html",
		htm: "html",
		css: "css",
		json: "json",
		yaml: "yaml",
		yml: "yaml",
		md: "markdown",
		markdown: "markdown",
	};
	return map[ext];
}

/**
 * Lightweight "syntax highlighting": splits code into lines. Real tokenization
 * is provided by the native highlighter upstream; here we preserve content
 * verbatim so the surrounding block renderer can lay it out.
 */
export function highlightCode(code: string, _language?: string): string[] {
	return code.split("\n");
}

/** Theme surface consumed by the shared TUI renderers. */
export interface Theme {
	fg(color: ThemeColor, text: string): string;
	bold(text: string): string;
	getFgAnsi(color: ThemeColor): string;
	getBgAnsi(bg: ThemeBg): string;
	styledSymbol(key: SymbolKey, color: ThemeColor): string;
	getLangIcon(lang: string | undefined): string;
	readonly spinnerFrames: string[];
	readonly boxSharp: {
		topLeft: string;
		topRight: string;
		bottomLeft: string;
		bottomRight: string;
		horizontal: string;
		vertical: string;
		cross: string;
		teeDown: string;
		teeUp: string;
		teeRight: string;
		teeLeft: string;
	};
	readonly tree: { branch: string; last: string; vertical: string };
	readonly sep: { dot: string; slash: string; pipe: string };
	readonly icon: { folder: string; file: string };
	readonly format: { bullet: string; dash: string; bracketLeft: string; bracketRight: string };
}

/** The default (gruvbox) theme instance. */
export const theme: Theme = {
	fg(color, text) {
		return `${fgAnsi(FG_HEX[color])}${text}\x1b[39m`;
	},
	bold(text) {
		return `\x1b[1m${text}\x1b[22m`;
	},
	getFgAnsi(color) {
		return fgAnsi(FG_HEX[color]);
	},
	getBgAnsi(bg) {
		return bgAnsi(BG_HEX[bg]);
	},
	styledSymbol(key, color) {
		return this.fg(color, SYMBOLS[key]);
	},
	getLangIcon(lang) {
		if (!lang) return LANG_DEFAULT_ICON;
		return LANG_ICONS[lang.toLowerCase()] ?? LANG_DEFAULT_ICON;
	},
	spinnerFrames: SPINNER_FRAMES,
	boxSharp: {
		topLeft: "┌",
		topRight: "┐",
		bottomLeft: "└",
		bottomRight: "┘",
		horizontal: "─",
		vertical: "│",
		cross: "┼",
		teeDown: "┬",
		teeUp: "┴",
		teeRight: "├",
		teeLeft: "┤",
	},
	tree: { branch: "├─", last: "└─", vertical: "│" },
	sep: { dot: " · ", slash: " / ", pipe: " │ " },
	icon: { folder: "📁", file: "📄" },
	format: { bullet: "•", dash: "—", bracketLeft: "⟦", bracketRight: "⟧" },
};

/** Markdown rendering theme used by the `Markdown` component. */
export function getMarkdownTheme(): MarkdownTheme {
	return {
		text: s => theme.fg("toolOutput", s),
		code: s => theme.fg("accent", s),
		heading: s => theme.bold(theme.fg("toolTitle", s)),
		bullet: theme.format.bullet,
	};
}
