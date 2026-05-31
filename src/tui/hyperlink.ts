/**
 * OSC 8 terminal hyperlink support for file paths.
 */

const OSC = "\x1b]";
const ST = "\x1b\\";

function buildLinkId(uri: string): string {
  let h = 0;
  for (let i = 0; i < uri.length; i++) {
    h = (Math.imul(31, h) + uri.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function buildFileUri(absPath: string, opts?: { line?: number; col?: number }): string {
  const normalized = absPath.replaceAll("\\", "/");
  const prefix = normalized.startsWith("/") ? "file://" : "file:///";
  const encoded = normalized.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  const params: string[] = [];
  if (opts?.line !== undefined) params.push(`line=${opts.line}`);
  if (opts?.col !== undefined) params.push(`col=${opts.col}`);
  const query = params.length > 0 ? `?${params.join("&")}` : "";
  return `${prefix}${encoded}${query}`;
}

export function isHyperlinkEnabled(): boolean {
  if (process.env.NO_COLOR) return false;
  if (!process.stdout.isTTY) return false;
  return true;
}

export function fileHyperlink(absPath: string, displayText: string, opts?: { line?: number; col?: number }): string {
  if (!isHyperlinkEnabled()) return displayText;
  if (displayText.includes("\x1b]8;")) return displayText;
  const uri = buildFileUri(absPath, opts);
  const id = buildLinkId(uri);
  return `${OSC}8;id=${id};${uri}${ST}${displayText}${OSC}8;;${ST}`;
}
