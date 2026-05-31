/**
 * Bordered output container with optional header and sections.
 */
import type { Theme } from "./theme.js";
import type { State } from "./types.js";
import { visibleWidth, padding, wrapTextWithAnsi, truncateToWidth } from "./text-utils.js";
import { getStateBgColor, padToWidth, buildCacheKey, type RenderCache } from "./utils.js";

export interface OutputBlockOptions {
  header?: string | undefined;
  headerMeta?: string | undefined;
  state?: State | undefined;
  sections?: Array<{ label?: string | undefined; lines: string[] }> | undefined;
  width: number;
  applyBg?: boolean | undefined;
  animate?: boolean | undefined;
}

const BORDER_SHIMMER_TICK_MS = 50;
const BORDER_BOUNCE_MS = 3000;
const BORDER_SEGMENT_LEN = 8;

export function borderShimmerTick(): number {
  return Math.floor(Date.now() / BORDER_SHIMMER_TICK_MS);
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export function borderSegmentHeadCol(W: number, now: number): number {
  if (W <= 1) return 0;
  const phase = (((now % BORDER_BOUNCE_MS) + BORDER_BOUNCE_MS) % BORDER_BOUNCE_MS) / BORDER_BOUNCE_MS;
  const leg = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  return easeInOutQuad(leg) * (W - 1);
}

function darkenFgAnsi(ansi: string, factor: number): string | undefined {
  const m = /38;2;(\d+);(\d+);(\d+)/.exec(ansi);
  if (!m) return undefined;
  const r = Math.round(Number(m[1]) * factor);
  const g = Math.round(Number(m[2]) * factor);
  const b = Math.round(Number(m[3]) * factor);
  return `\x1b[38;2;${r};${g};${b}m`;
}

type BlockRow =
  | { kind: "bar"; leftChar: string; rightChar: string; label?: string | undefined; meta?: string | undefined }
  | { kind: "bottom"; leftChar: string; rightChar: string }
  | { kind: "content"; inner: string };

export function renderOutputBlock(options: OutputBlockOptions, theme: Theme): string[] {
  const { header, headerMeta, state, sections = [], width, applyBg = true } = options;
  const h = theme.boxSharp.horizontal;
  const v = theme.boxSharp.vertical;
  const cap = h.repeat(3);
  const lineWidth = Math.max(0, width);
  const borderColor: "error" | "warning" | "accent" | "dim" =
    state === "error"
      ? "error"
      : state === "warning"
        ? "warning"
        : state === "running" || state === "pending"
          ? "accent"
          : "dim";
  const border = (text: string) => theme.fg(borderColor, text);
  const bgFn = (() => {
    if (!state || !applyBg) return undefined;
    const bgAnsi = theme.getBgAnsi(getStateBgColor(state));
    return (text: string) => {
      const stabilized = text
        .replace(/\x1b\[(?:0)?m/g, (m) => `${m}${bgAnsi}`)
        .replace(/\x1b\[49m/g, (m) => `${m}${bgAnsi}`);
      return `${bgAnsi}${stabilized}\x1b[49m`;
    };
  })();

  const contentWidth = Math.max(0, lineWidth - visibleWidth(`${v} `) - visibleWidth(v));

  const rows: BlockRow[] = [];
  rows.push({
    kind: "bar",
    leftChar: theme.boxSharp.topLeft,
    rightChar: theme.boxSharp.topRight,
    label: header ?? undefined,
    meta: headerMeta ?? undefined,
  });

  const normalizedSections = sections.length > 0 ? sections : [{ lines: [] as string[] }];
  for (const section of normalizedSections) {
    if (section.label) {
      rows.push({
        kind: "bar",
        leftChar: theme.boxSharp.teeRight,
        rightChar: theme.boxSharp.teeLeft,
        label: section.label,
      });
    }
    const allLines = section.lines.flatMap((l) => l.split("\n"));
    for (const line of allLines) {
      const wrappedLines = wrapTextWithAnsi(line.trimEnd(), contentWidth);
      for (const wrappedLine of wrappedLines) {
        const innerPadding = padding(Math.max(0, contentWidth - visibleWidth(wrappedLine)));
        rows.push({ kind: "content", inner: `${wrappedLine}${innerPadding}` });
      }
    }
  }

  rows.push({ kind: "bottom", leftChar: theme.boxSharp.bottomLeft, rightChar: theme.boxSharp.bottomRight });

  const H = rows.length;
  const W = lineWidth;
  const animate = (options.animate ?? false) && (state === "running" || state === "pending") && W >= 2 && H >= 2;

  const segLen = animate ? Math.min(BORDER_SEGMENT_LEN, W) : 0;
  const head = animate ? borderSegmentHeadCol(W, Date.now()) : 0;
  const segHalf = segLen / 2;
  const segAnsi = animate ? (darkenFgAnsi(theme.getFgAnsi(borderColor), 0.4) ?? theme.getFgAnsi("borderMuted")) : "";
  const seg = (text: string) => `${segAnsi}${text}\x1b[39m`;

  const isLit = (col: number): boolean => Math.abs(col - head) < segHalf;

  const colorEdge = (glyphs: string, startCol: number): string => {
    let out = "";
    let runLit: boolean | null = null;
    let buf = "";
    for (let i = 0; i < glyphs.length; i++) {
      const lit = isLit(startCol + i);
      if (lit !== runLit) {
        if (runLit !== null) out += (runLit ? seg : border)(buf);
        buf = "";
        runLit = lit;
      }
      buf += glyphs[i];
    }
    if (runLit !== null) out += (runLit ? seg : border)(buf);
    return out;
  };

  const renderBar = (row: { leftChar: string; rightChar: string; label?: string | undefined; meta?: string | undefined }): string => {
    const leftGlyphs = `${row.leftChar}${cap}`;
    const rightGlyph = row.rightChar;
    if (lineWidth <= 0) return border(leftGlyphs) + border(rightGlyph);
    const labelText = [row.label, row.meta].filter(Boolean).join(theme.sep.dot);
    const rawLabel = labelText ? ` ${labelText} ` : " ";
    const leftWidth = visibleWidth(leftGlyphs);
    const rightWidth = visibleWidth(rightGlyph);
    const maxLabelWidth = Math.max(0, lineWidth - leftWidth - rightWidth);
    const trimmedLabel = truncateToWidth(rawLabel, maxLabelWidth);
    const labelWidth = visibleWidth(trimmedLabel);
    const fillCount = Math.max(0, lineWidth - leftWidth - labelWidth - rightWidth);
    const fillGlyphs = h.repeat(fillCount);
    return `${border(leftGlyphs)}${trimmedLabel}${border(fillGlyphs)}${border(rightGlyph)}`;
  };

  const renderBottom = (row: { leftChar: string; rightChar: string }): string => {
    const leftGlyphs = `${row.leftChar}${cap}`;
    const rightGlyph = row.rightChar;
    const fillCount = Math.max(0, lineWidth - visibleWidth(leftGlyphs) - visibleWidth(rightGlyph));
    const fillGlyphs = h.repeat(fillCount);
    if (!animate) return `${border(leftGlyphs)}${border(fillGlyphs)}${border(rightGlyph)}`;
    const leftStr = colorEdge(leftGlyphs, 0);
    const fillStr = colorEdge(fillGlyphs, visibleWidth(leftGlyphs));
    const rightStr = colorEdge(rightGlyph, lineWidth - visibleWidth(rightGlyph));
    return `${leftStr}${fillStr}${rightStr}`;
  };

  const renderContent = (inner: string): string => `${border(`${v} `)}${inner}${border(v)}`;

  const lines: string[] = [];
  for (let r = 0; r < H; r++) {
    const row = rows[r]!;
    const line =
      row.kind === "bar" ? renderBar(row) : row.kind === "bottom" ? renderBottom(row) : renderContent(row.inner);
    lines.push(padToWidth(line, lineWidth, bgFn));
  }

  return lines;
}

export class CachedOutputBlock {
  #cache?: RenderCache | undefined;

  render(options: OutputBlockOptions, theme: Theme): string[] {
    const key = this.#buildKey(options);
    if (this.#cache?.key === key) return this.#cache.lines;
    const lines = renderOutputBlock(options, theme);
    this.#cache = { key, lines };
    return lines;
  }

  invalidate(): void {
    this.#cache = undefined;
  }

  #buildKey(options: OutputBlockOptions): bigint {
    const parts: Array<string | number | boolean | undefined> = [
      options.width,
      options.header,
      options.headerMeta,
      options.state,
      options.applyBg ?? true,
      options.animate ?? false,
    ];
    if (options.animate) parts.push(borderShimmerTick());
    if (options.sections) {
      for (const s of options.sections) {
        parts.push(s.label);
        for (const line of s.lines) {
          parts.push(line);
        }
      }
    }
    return buildCacheKey(parts);
  }
}
