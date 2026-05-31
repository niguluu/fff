import { execSync } from "child_process";
import { existsSync, mkdirSync, cpSync, rmSync, writeFileSync } from "fs";
import { tmpdir, homedir } from "os";
import { join } from "path";

const REPO_URL = "https://github.com/niguluu/fff";
const ARCHIVE_URL = `${REPO_URL}/archive/refs/heads/main.tar.gz`;
const INSTALL_DIR = process.env.FFF_INSTALL_DIR || join(homedir(), ".fff");
const BIN_DIR = process.env.FFF_BIN_DIR || join(homedir(), ".local", "bin");
const BIN_PATH = join(BIN_DIR, "fff");

function log(msg: string) {
  console.log(`==> ${msg}`);
}

function run(cmd: string): string {
  return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "inherit"] }).trim();
}

export async function runUpdate() {
  log("fff update — fetching latest source");

  // Create temp dir
  const tmpRoot = join(tmpdir(), `fff-update-${Date.now()}`);
  mkdirSync(tmpRoot, { recursive: true });

  try {
    // Download archive
    const archivePath = join(tmpRoot, "fff.tar.gz");
    log("Downloading source archive");
    run(`curl --fail --silent --show-error --location "${ARCHIVE_URL}" -o "${archivePath}"`);

    // Extract
    const extractDir = join(tmpRoot, "extract");
    mkdirSync(extractDir, { recursive: true });
    log("Extracting source archive");
    run(`tar -xzf "${archivePath}" -C "${extractDir}"`);

    // Find the extracted directory
    const dirs = execSync(`ls -d "${extractDir}"/*/`, { encoding: "utf-8" }).trim().split("\n");
    const sourceDir = dirs[0]?.trim();
    if (!sourceDir || !existsSync(join(sourceDir, "package.json"))) {
      throw new Error("Failed to find extracted source directory");
    }

    log(`Building fff in ${sourceDir}`);
    run(`cd "${sourceDir}" && bun install --frozen-lockfile`);
    run(`cd "${sourceDir}" && bun build src/index.tsx --outdir dist --target node --external react-devtools-core`);

    // Stage the install
    const stageDir = `${INSTALL_DIR}.stage`;
    rmSync(stageDir, { recursive: true, force: true });
    mkdirSync(join(stageDir, "dist"), { recursive: true });

    cpSync(join(sourceDir, "dist", "index.js"), join(stageDir, "dist", "index.js"));

    // Copy yoga.wasm if present
    const yogaWasm = join(sourceDir, "node_modules", "yoga-wasm-web", "dist", "yoga.wasm");
    if (existsSync(yogaWasm)) {
      cpSync(yogaWasm, join(stageDir, "dist", "yoga.wasm"));
    }

    // Preserve existing .env
    const existingEnv = join(INSTALL_DIR, ".env");
    if (existsSync(existingEnv)) {
      cpSync(existingEnv, join(stageDir, ".env"));
      log("Preserved existing .env config");
    } else if (existsSync(join(sourceDir, ".env.example"))) {
      cpSync(join(sourceDir, ".env.example"), join(stageDir, ".env"));
      log("Created .env from example — edit it to set your OPENAI_API_KEY");
    }

    // Install
    log(`Installing to ${INSTALL_DIR}`);
    rmSync(INSTALL_DIR, { recursive: true, force: true });
    renameSync(stageDir, INSTALL_DIR);

    // Ensure wrapper script
    mkdirSync(BIN_DIR, { recursive: true });
    const wrapper = `#!/usr/bin/env bash
set -euo pipefail
FFF_HOME="\${FFF_INSTALL_DIR:-$HOME/.fff}"
if [[ ! -f "$FFF_HOME/dist/index.js" ]]; then
  echo "Error: fff not found at $FFF_HOME/dist/index.js" >&2
  echo "Re-run the install script." >&2
  exit 1
fi
if [[ -f "$FFF_HOME/.env" ]]; then
  set -a
  source "$FFF_HOME/.env"
  set +a
fi
exec bun run "$FFF_HOME/dist/index.js" "$@"
`;
    writeFileSync(BIN_PATH, wrapper, "utf-8");
    run(`chmod +x "${BIN_PATH}"`);

    log(`Updated wrapper at ${BIN_PATH}`);
    log("Done. fff is up to date.");
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

function renameSync(oldPath: string, newPath: string) {
  execSync(`mv "${oldPath}" "${newPath}"`, { stdio: "inherit" });
}
