/**
 * Minimal text utilities replacing @oh-my-pi/pi-tui dependencies.
 */

const ANSI_PATTERN = /\x1b\[[\d;]*[a-zA-Z]/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

export function visibleWidth(text: string): number {
  return stripAnsi(text).length;
}

export function padding(n: number): string {
  return " ".repeat(Math.max(0, n));
}

export function replaceTabs(text: string, tabWidth = 2): string {
  return text.replace(/\t/g, " ".repeat(tabWidth));
}

export function truncateToWidth(text: string, width: number, ellipsis: string = "…"): string {
  const plain = stripAnsi(text);
  if (plain.length <= width) return text;
  const target = Math.max(0, width - ellipsis.length);
  let plainCount = 0;
  let origIdx = 0;
  for (const ch of text) {
    if (ch === "\x1b") {
      const end = text.indexOf("m", origIdx);
      if (end > origIdx) {
        origIdx = end + 1;
        continue;
      }
    }
    if (plainCount >= target) break;
    plainCount += stripAnsi(ch).length;
    origIdx += ch.length;
  }
  return text.slice(0, origIdx) + ellipsis;
}

export function wrapText(text: string, width: number): string[] {
  const safeWidth = Math.max(8, width);
  const sourceLines = text.length === 0 ? [""] : text.split(/\r?\n/);
  const wrapped: string[] = [];

  for (const sourceLine of sourceLines) {
    if (sourceLine.length === 0) {
      wrapped.push("");
      continue;
    }
    let remaining = sourceLine;
    while (visibleWidth(remaining) > safeWidth) {
      const plain = stripAnsi(remaining);
      let cut = safeWidth;
      const lastSpace = plain.slice(0, safeWidth).lastIndexOf(" ");
      if (lastSpace > 0) {
        cut = lastSpace;
      }
      let plainCount = 0;
      let origIdx = 0;
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i] === "\x1b") {
          const end = remaining.indexOf("m", i);
          if (end > i) {
            origIdx += end - i + 1;
            i = end;
            continue;
          }
        }
        if (plainCount >= cut) break;
        plainCount++;
        origIdx++;
      }
      wrapped.push(remaining.slice(0, origIdx));
      remaining = remaining.slice(origIdx).trimStart();
      if (remaining.length === 0) break;
    }
    if (remaining.length > 0) {
      wrapped.push(remaining);
    }
  }

  return wrapped;
}

export function wrapTextWithAnsi(text: string, width: number): string[] {
  return wrapText(text, width);
}

export function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m`;
}
