// Auto-generated version from package.json
// This file is read at runtime — no build step needed.
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

let _version: string | null = null;

export function getVersion(): string {
  if (_version) return _version;
  try {
    // Try relative to the source file first (dev mode)
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    _version = pkg.version ?? "0.0.0";
  } catch {
    // Fallback: try from dist (installed mode)
    try {
      const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
      _version = pkg.version ?? "0.0.0";
    } catch {
      _version = "0.0.0";
    }
  }
  return _version;
}
