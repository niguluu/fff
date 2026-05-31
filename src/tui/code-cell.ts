/**
 * Render a code or markdown cell with optional output section.
 */
import type { Theme } from "./theme.js";
import {
  formatDuration,
  formatExpandHint,
  formatMoreItems,
  formatStatusIcon,
  replaceTabs,
} from "./render-utils.js";
import { renderOutputBlock } from "./output-block.js";
import type { State } from "./types.js";

export interface CodeCellOptions {
  code: string;
  language?: string | undefined;
  index?: number | undefined;
  total?: number | undefined;
  title?: string | undefined;
  status?: "pending" | "running" | "warning" | "complete" | "error" | undefined;
  spinnerFrame?: number | undefined;
  duration?: number | undefined;
  output?: string | undefined;
  outputMaxLines?: number | undefined;
  codeMaxLines?: number | undefined;
  expanded?: boolean | undefined;
  animate?: boolean | undefined;
  width: number;
}

function getState(status?: CodeCellOptions["status"]): State | undefined {
  if (!status) return undefined;
  if (status === "complete") return "success";
  if (status === "error") return "error";
  if (status === "warning") return "warning";
  if (status === "running") return "running";
  return "pending";
}

function formatHeader(options: CodeCellOptions, theme: Theme): { title: string; meta?: string } {
  const { index, total, title, status, spinnerFrame, duration } = options;
  const parts: string[] = [];
  if (status) {
    const icon = formatStatusIcon(
      status === "complete"
        ? "success"
        : status === "error"
          ? "error"
          : status === "warning"
            ? "warning"
            : status === "running"
              ? "running"
              : "pending",
      theme,
      spinnerFrame,
    );
    if (status === "pending" || status === "running") {
      parts.push(`${icon} ${theme.fg("muted", status)}`);
    } else {
      parts.push(icon);
    }
  }
  if (index !== undefined && total !== undefined) {
    parts.push(theme.fg("accent", `[${index + 1}/${total}]`));
  }
  if (title) {
    parts.push(theme.fg("toolTitle", title));
  }
  const headerTitle = parts.length > 0 ? parts.join(" ") : theme.fg("toolTitle", "Code");

  const metaParts: string[] = [];
  if (duration !== undefined) {
    metaParts.push(theme.fg("dim", `(${formatDuration(duration)})`));
  }
  if (metaParts.length === 0) return { title: headerTitle };
  return { title: headerTitle, meta: metaParts.join(theme.fg("dim", theme.sep.dot)) };
}

function sanitizeTerminalLines(text: string): string[] {
  return text.split(/\r?\n/).map((line) => {
    const idx = line.lastIndexOf("\r");
    return idx < 0 ? line : line.slice(idx + 1);
  });
}

function highlightCode(code: string, _language?: string): string[] {
  // Minimal stub — no syntax highlighting.
  return code.split("\n");
}

export function renderCodeCell(options: CodeCellOptions, theme: Theme): string[] {
  const { code, output, expanded = false, outputMaxLines = 6, codeMaxLines = 12, width } = options;
  const { title, meta } = formatHeader(options, theme);
  const state = getState(options.status);

  const normalizedCode = replaceTabs(code ?? "");
  const rawCodeLines = sanitizeTerminalLines(normalizedCode);
  const maxCodeLines = expanded ? rawCodeLines.length : Math.min(rawCodeLines.length, codeMaxLines);
  const visibleCode = rawCodeLines.slice(0, maxCodeLines).join("\n");
  const codeLines = highlightCode(visibleCode, options.language);
  const hiddenCodeLines = rawCodeLines.length - maxCodeLines;
  if (hiddenCodeLines > 0) {
    const hint = formatExpandHint(theme, expanded, hiddenCodeLines > 0);
    const moreLine = `${formatMoreItems(hiddenCodeLines, "line")}${hint ? ` ${hint}` : ""}`;
    codeLines.push(theme.fg("dim", moreLine));
  }

  const outputLines: string[] = [];
  if (output?.trim()) {
    const rawLines = sanitizeTerminalLines(output);
    const maxLines = expanded ? rawLines.length : Math.min(rawLines.length, outputMaxLines);
    const displayLines = rawLines.slice(0, maxLines).map((line) =>
      line.includes("\x1b[") ? replaceTabs(line) : theme.fg("toolOutput", replaceTabs(line)),
    );
    outputLines.push(...displayLines);
    const remaining = rawLines.length - maxLines;
    if (remaining > 0) {
      const hint = formatExpandHint(theme, expanded, remaining > 0);
      const moreLine = `${formatMoreItems(remaining, "line")}${hint ? ` ${hint}` : ""}`;
      outputLines.push(theme.fg("dim", moreLine));
    }
  }

  const sections: Array<{ label?: string; lines: string[] }> = [{ lines: codeLines }];
  if (outputLines.length > 0) {
    sections.push({ label: theme.fg("toolTitle", "Output"), lines: outputLines });
  }

  return renderOutputBlock(
    { header: title, headerMeta: meta ?? undefined, state: state ?? undefined, sections, width, animate: options.animate },
    theme,
  );
}

export interface MarkdownCellOptions {
  content: string;
  index?: number | undefined;
  total?: number | undefined;
  title?: string | undefined;
  status?: "pending" | "running" | "warning" | "complete" | "error" | undefined;
  spinnerFrame?: number | undefined;
  duration?: number | undefined;
  output?: string | undefined;
  outputMaxLines?: number | undefined;
  contentMaxLines?: number | undefined;
  expanded?: boolean | undefined;
  width: number;
}

function simpleMarkdownRender(content: string, _innerWidth: number): string[] {
  // Minimal markdown: just split lines and handle basic headers.
  return content.split("\n").map((line) => {
    if (line.startsWith("# ")) return `━━ ${line.slice(2)}`;
    if (line.startsWith("## ")) return `── ${line.slice(3)}`;
    if (line.startsWith("### ")) return `  ${line.slice(4)}`;
    return line;
  });
}

export function renderMarkdownCell(options: MarkdownCellOptions, theme: Theme): string[] {
  const { content, output, expanded = false, outputMaxLines = 6, contentMaxLines = 12, width } = options;
  const codeOptions: CodeCellOptions = {
    code: "",
    index: options.index ?? undefined,
    total: options.total ?? undefined,
    title: options.title ?? undefined,
    status: options.status ?? undefined,
    spinnerFrame: options.spinnerFrame ?? undefined,
    duration: options.duration ?? undefined,
    width,
  };
  const { title, meta } = formatHeader(codeOptions, theme);
  const state = getState(options.status);

  const innerWidth = Math.max(20, width - 3);
  const allLines = content.trim() ? simpleMarkdownRender(content, innerWidth) : [];
  const maxContentLines = expanded ? allLines.length : Math.min(allLines.length, contentMaxLines);
  const contentLines = allLines.slice(0, maxContentLines);
  const hiddenContentLines = allLines.length - maxContentLines;
  if (hiddenContentLines > 0) {
    const hint = formatExpandHint(theme, expanded, hiddenContentLines > 0);
    const moreLine = `${formatMoreItems(hiddenContentLines, "line")}${hint ? ` ${hint}` : ""}`;
    contentLines.push(theme.fg("dim", moreLine));
  }

  const outputLines: string[] = [];
  if (output?.trim()) {
    const rawLines = sanitizeTerminalLines(output);
    const maxLines = expanded ? rawLines.length : Math.min(rawLines.length, outputMaxLines);
    const displayLines = rawLines.slice(0, maxLines).map((line) =>
      line.includes("\x1b[") ? replaceTabs(line) : theme.fg("toolOutput", replaceTabs(line)),
    );
    outputLines.push(...displayLines);
    const remaining = rawLines.length - maxLines;
    if (remaining > 0) {
      const hint = formatExpandHint(theme, expanded, remaining > 0);
      const moreLine = `${formatMoreItems(remaining, "line")}${hint ? ` ${hint}` : ""}`;
      outputLines.push(theme.fg("dim", moreLine));
    }
  }

  const sections: Array<{ label?: string; lines: string[] }> = [{ lines: contentLines }];
  if (outputLines.length > 0) {
    sections.push({ label: theme.fg("toolTitle", "Output"), lines: outputLines });
  }

  return renderOutputBlock({ header: title, headerMeta: meta ?? undefined, state: state ?? undefined, sections, width }, theme);
}
