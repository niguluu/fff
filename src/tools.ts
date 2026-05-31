import { mkdir, readdir, rename, unlink } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { homedir } from "node:os";

const WORKING_DIR = resolve(process.env.WORKING_DIR || process.cwd());

export interface ToolMetadata {
  name: string;
  description: string;
  signature: string;
}

export function resolveAbsPath(pathStr: string): string {
  let p = pathStr;
  if (p.startsWith("~")) {
    p = p.replace("~", homedir() || process.env.HOME || "/root");
  }
  const resolved = resolve(WORKING_DIR, p);
  const realResolved = resolve(resolved);
  const realWorking = resolve(WORKING_DIR);
  // Ensure the check boundary is at a directory separator to prevent prefix attacks
  const isInside =
    realResolved === realWorking ||
    realResolved.startsWith(realWorking + sep);
  if (!isInside) {
    throw new Error(
      `Path traversal blocked: ${pathStr} resolves outside working directory (${WORKING_DIR})`
    );
  }
  return resolved;
}

export const TOOL_METADATA: ToolMetadata[] = [
  {
    name: "read_file",
    description:
      "Reads the full content of any file. Use the optional 'limit' param to read only the first N lines for huge files.",
    signature:
      'read_file(filename: string, limit?: number) -> {file_path: string, content: string, truncated?: boolean, total_lines?: number}',
  },
  {
    name: "list_files",
    description: "Lists the files in a directory provided by the user.",
    signature:
      'list_files(path: string) -> {path: string, files: [{filename: string, type: "file" | "dir"}]}',
  },
  {
    name: "edit_file",
    description:
      'Replaces the first occurrence of old_str with new_str in a file. Use old_str="" to create a new file.',
    signature:
      'edit_file(path: string, old_str: string, new_str: string) -> {path: string, action: string}',
  },
  {
    name: "atomic_overwrite",
    description:
      "Completely replaces the entire contents of a file atomically via tmp-file + OS rename. Use this when creating new files from scratch, rewriting tiny files, or when you need crash-safe full replacement.",
    signature:
      "atomic_overwrite(filename: string, new_content: string) -> {action: string}",
  },
];

export async function readFileTool(filename: string, limit?: number) {
  const fullPath = resolveAbsPath(filename);
  try {
    const file = Bun.file(fullPath);
    // Check binary by looking for null bytes in first 8KB
    const buf = await file.arrayBuffer();
    const view = new Uint8Array(buf, 0, Math.min(buf.byteLength, 8192));
    const isBinary = view.includes(0);
    if (isBinary) {
      return {
        file_path: fullPath,
        error: "Binary file detected — cannot display binary content",
      };
    }
    const content = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    if (limit && limit > 0) {
      const lines = content.split("\n");
      if (lines.length > limit) {
        const truncated = lines.slice(0, limit).join("\n");
        return {
          file_path: fullPath,
          content: truncated,
          truncated: true,
          total_lines: lines.length,
        };
      }
    }
    return { file_path: fullPath, content };
  } catch (e: any) {
    return { file_path: fullPath, error: e.message as string };
  }
}

export async function listFilesTool(path: string) {
  const fullPath = resolveAbsPath(path);
  try {
    const items = await readdir(fullPath, { withFileTypes: true });
    return {
      path: fullPath,
      files: items.map((i) => ({
        filename: i.name,
        type: i.isFile() ? "file" : ("dir" as const),
      })),
    };
  } catch (e: any) {
    return { path: fullPath, error: e.message as string };
  }
}

export async function editFileTool(
  path: string,
  oldStr: string,
  newStr: string
) {
  const fullPath = resolveAbsPath(path);
  try {
    if (oldStr === "") {
      const fileExists = await Bun.file(fullPath).exists();
      if (fileExists) {
        return {
          path: fullPath,
          action:
            "file already exists — use atomic_overwrite to replace entire file",
        };
      }
      await mkdir(dirname(fullPath), { recursive: true });
      await Bun.write(fullPath, newStr);
      return { path: fullPath, action: "created_file" };
    }
    const original = await Bun.file(fullPath).text();
    if (!original.includes(oldStr)) {
      return { path: fullPath, action: "old_str not found" };
    }
    const edited = original.replace(oldStr, newStr);
    await Bun.write(fullPath, edited);
    return { path: fullPath, action: "edited" };
  } catch (e: any) {
    return { path: fullPath, error: e.message as string };
  }
}

export async function atomicOverwriteTool(
  filename: string,
  newContent: string
) {
  const fullPath = resolveAbsPath(filename);
  const tmpPath = `${fullPath}.tmp`;
  try {
    await Bun.write(tmpPath, newContent);
    await rename(tmpPath, fullPath);
    return { action: `Atomically overwrote entire file: ${fullPath}` };
  } catch (e: any) {
    try {
      await unlink(tmpPath);
    } catch {
      /* tmp may not exist */
    }
    return { error: e.message as string };
  }
}
