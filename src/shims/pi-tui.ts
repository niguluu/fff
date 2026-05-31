/**
 * Minimal local shim for `@oh-my-pi/pi-tui`.
 *
 * The upstream package delegates width/wrap/truncate to the native Rust
 * `@oh-my-pi/pi-natives` addon, which is not available in this project. This
 * shim re-implements the small surface the ported TUI components rely on using
 * pure JS (Bun's `stringWidth` for terminal-cell measurement).
 */

/** ANSI CSI/OSC escape sequence matcher (visible width = 0). */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching terminal escapes
const ANSI_ESCAPE_REGEX =
	/[\u001b\u009b][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

/** Ellipsis style enum (mirrors the subset used by `truncateToWidth`). */
export enum Ellipsis {
	Unicode = 0,
	Ascii = 1,
	Omit = 2,
}

/** Terminal inline-image protocol. */
export enum ImageProtocol {
	None = 0,
	Sixel = 1,
	Kitty = 2,
	ITerm = 3,
}

const SPACE_BUFFER = " ".repeat(512);

/** Number of spaces a tab expands to. */
const TAB_WIDTH = 4;

/** Returns a string of `n` spaces. */
export function padding(n: number): string {
	if (n <= 0) return "";
	if (n <= 512) return SPACE_BUFFER.slice(0, n);
	return " ".repeat(n);
}

/** Replace tabs with a fixed number of spaces for consistent rendering. */
export function replaceTabs(text: string): string {
	return text.replaceAll("\t", " ".repeat(TAB_WIDTH));
}

/** Visible width of a string in terminal columns, ignoring ANSI escapes. */
export function visibleWidth(str: string): number {
	if (!str) return 0;
	// Bun.stringWidth ignores ANSI escape codes by default and accounts for
	// wide (CJK/emoji) characters.
	return Bun.stringWidth(str);
}

/**
 * Truncate `text` so its visible width does not exceed `maxWidth`, optionally
 * appending an ellipsis and/or right-padding to `maxWidth`.
 */
export function truncateToWidth(
	text: string,
	maxWidth: number,
	ellipsisKind?: Ellipsis | null,
	pad?: boolean | null,
): string {
	const safeWidth = Number.isFinite(maxWidth) ? Math.max(0, Math.trunc(maxWidth)) : 0;
	if (safeWidth === 0) return "";
	if (visibleWidth(text) <= safeWidth) {
		return pad ? text + padding(safeWidth - visibleWidth(text)) : text;
	}
	const ellipsis = ellipsisKind === Ellipsis.Omit ? "" : ellipsisKind === Ellipsis.Ascii ? "..." : "…";
	const budget = Math.max(0, safeWidth - visibleWidth(ellipsis));
	const sliced = sliceVisible(text, budget);
	const result = `${sliced}${ellipsis}`;
	return pad ? result + padding(Math.max(0, safeWidth - visibleWidth(result))) : result;
}

/**
 * Slice the first `width` visible columns of `text`, passing ANSI escape
 * sequences through without counting them toward the column budget.
 */
function sliceVisible(text: string, width: number): string {
	if (width <= 0) return "";
	let out = "";
	let used = 0;
	let i = 0;
	while (i < text.length) {
		ANSI_ESCAPE_REGEX.lastIndex = i;
		const match = ANSI_ESCAPE_REGEX.exec(text);
		if (match && match.index === i) {
			out += match[0];
			i = ANSI_ESCAPE_REGEX.lastIndex;
			continue;
		}
		const ch = String.fromCodePoint(text.codePointAt(i) ?? text.charCodeAt(i));
		const w = visibleWidth(ch);
		if (used + w > width) break;
		out += ch;
		used += w;
		i += ch.length;
	}
	return out;
}

/**
 * Wrap `text` to `width` visible columns, ANSI-aware. Breaks on spaces where
 * possible and hard-splits words that exceed the width.
 */
export function wrapTextWithAnsi(text: string, width: number): string[] {
	if (width <= 0) return [text];
	const out: string[] = [];
	for (const rawLine of text.split("\n")) {
		if (visibleWidth(rawLine) <= width) {
			out.push(rawLine);
			continue;
		}
		const words = rawLine.split(/(\s+)/);
		let current = "";
		for (const word of words) {
			if (word === "") continue;
			if (visibleWidth(current) + visibleWidth(word) <= width) {
				current += word;
				continue;
			}
			if (current.trim() !== "") out.push(current);
			current = "";
			if (visibleWidth(word) <= width) {
				current = word.trimStart();
			} else {
				// Hard-split an over-long word across multiple rows.
				let rest = word;
				while (visibleWidth(rest) > width) {
					const chunk = sliceVisible(rest, width);
					out.push(chunk);
					rest = rest.slice(chunk.length);
				}
				current = rest;
			}
		}
		if (current !== "") out.push(current);
	}
	return out.length > 0 ? out : [""];
}

/** Theme surface consumed by the {@link Markdown} renderer. */
export interface MarkdownTheme {
	/** Wrap text in a foreground color escape. */
	text: (s: string) => string;
	/** Style inline code / fenced blocks. */
	code: (s: string) => string;
	/** Style headings. */
	heading: (s: string) => string;
	/** Bullet glyph for list items. */
	bullet: string;
}

/**
 * Minimal Markdown renderer.
 *
 * The upstream component performs full CommonMark parsing with syntax
 * highlighting; this shim applies lightweight line-level styling (headings,
 * bullets, fenced code) and wraps to the requested width, which is sufficient
 * for the ported cell renderers.
 */
export class Markdown {
	#content: string;
	#theme: MarkdownTheme;

	constructor(content: string, _x: number, _y: number, theme: MarkdownTheme) {
		this.#content = content;
		this.#theme = theme;
	}

	render(width: number): string[] {
		const lines: string[] = [];
		let inFence = false;
		for (const raw of this.#content.split("\n")) {
			const trimmed = raw.trimStart();
			if (trimmed.startsWith("```")) {
				inFence = !inFence;
				lines.push(this.#theme.code(raw));
				continue;
			}
			if (inFence) {
				for (const w of wrapTextWithAnsi(raw, width)) lines.push(this.#theme.code(w));
				continue;
			}
			if (/^#{1,6}\s+/.test(trimmed)) {
				const heading = trimmed.replace(/^#{1,6}\s+/, "");
				for (const w of wrapTextWithAnsi(heading, width)) lines.push(this.#theme.heading(w));
				continue;
			}
			if (/^[-*+]\s+/.test(trimmed)) {
				const item = trimmed.replace(/^[-*+]\s+/, "");
				const prefix = `${this.#theme.bullet} `;
				const wrapped = wrapTextWithAnsi(item, Math.max(1, width - visibleWidth(prefix)));
				wrapped.forEach((w, idx) => {
					lines.push(idx === 0 ? this.#theme.text(`${prefix}${w}`) : this.#theme.text(`  ${w}`));
				});
				continue;
			}
			for (const w of wrapTextWithAnsi(raw, width)) lines.push(this.#theme.text(w));
		}
		return lines;
	}
}

/** Terminal capability snapshot used by hyperlink/image rendering. */
export const TERMINAL: { hyperlinks: boolean; imageProtocol: ImageProtocol } = (() => {
	const term = Bun.env.TERM ?? "";
	const termProgram = Bun.env.TERM_PROGRAM ?? "";
	// Hyperlink support is broadly available in modern terminals; enable it for
	// common emulators that advertise themselves.
	const hyperlinks = /iterm|vte|kitty|wezterm|ghostty/i.test(termProgram) || /kitty|xterm|vte/i.test(term);
	let imageProtocol = ImageProtocol.None;
	if (termProgram.toLowerCase().includes("iterm")) imageProtocol = ImageProtocol.ITerm;
	else if (term.includes("kitty")) imageProtocol = ImageProtocol.Kitty;
	return { hyperlinks, imageProtocol };
})();
