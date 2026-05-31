#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/niguluu/fff"
ARCHIVE_URL="${FFF_ARCHIVE_URL:-$REPO_URL/archive/refs/heads/main.tar.gz}"
INSTALL_DIR="${FFF_INSTALL_DIR:-$HOME/.fff}"
BIN_DIR="${FFF_BIN_DIR:-$HOME/.local/bin}"
BIN_PATH="$BIN_DIR/fff"
CACHE_BUST="${FFF_CACHE_BUST:-$(date +%s)}"
KEEP_TEMP="${FFF_KEEP_TEMP:-0}"

log() {
  echo "==> $*"
}

cleanup() {
  if [[ "${KEEP_TEMP}" != "1" ]] && [[ -n "${TMP_ROOT:-}" ]] && [[ -d "${TMP_ROOT:-}" ]]; then
    rm -rf "$TMP_ROOT"
  fi
}

trap cleanup EXIT

log "fff installer (fucking fucking fast)"

# ---------------------------------------------------------------------------
# Toolchain bootstrap: ensure mise + bun are available for new users.
# Set FFF_SKIP_BOOTSTRAP=1 to skip and require a pre-installed bun.
# ---------------------------------------------------------------------------
ensure_path_has() {
  case ":$PATH:" in
    *":$1:"*) ;;
    *) export PATH="$1:$PATH" ;;
  esac
}

bootstrap_toolchain() {
  # Make common install locations visible for this session.
  ensure_path_has "$HOME/.local/bin"
  ensure_path_has "$HOME/.local/share/mise/shims"
  ensure_path_has "$HOME/.bun/bin"

  if command -v bun &>/dev/null; then
    return 0
  fi

  log "bun not found — bootstrapping toolchain"

  # Prefer mise to manage bun if available or installable.
  if ! command -v mise &>/dev/null; then
    log "Installing mise"
    if command -v curl &>/dev/null; then
      curl -fsSL https://mise.run | sh || log "mise install via curl failed; will try direct bun install"
    fi
    ensure_path_has "$HOME/.local/bin"
    ensure_path_has "$HOME/.local/share/mise/shims"
  fi

  if command -v mise &>/dev/null; then
    log "Installing bun via mise"
    mise use -g bun@latest || mise install bun@latest || true
    eval "$(mise activate bash 2>/dev/null)" || true
    ensure_path_has "$HOME/.local/share/mise/shims"
  fi

  # Fallback: official bun installer.
  if ! command -v bun &>/dev/null; then
    log "Installing bun via bun.sh"
    if command -v curl &>/dev/null; then
      curl -fsSL https://bun.sh/install | bash || true
    fi
    ensure_path_has "$HOME/.bun/bin"
  fi
}

if [[ "${FFF_SKIP_BOOTSTRAP:-0}" != "1" ]]; then
  bootstrap_toolchain
fi

if ! command -v bun &>/dev/null; then
  echo "Error: bun is still not installed after bootstrap." >&2
  echo "Install it manually (https://bun.sh) or via mise (https://mise.jdx.dev) and re-run." >&2
  exit 1
fi

log "Using bun: $(command -v bun) ($(bun --version 2>/dev/null || echo unknown))"

SCRIPT_DIR=""
if [[ -n "${BASH_SOURCE+set}" ]]; then
  if [[ -n "${BASH_SOURCE[0]:-}" ]] && [[ "${BASH_SOURCE[0]}" != "bash" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  fi
fi

if [[ -z "$SCRIPT_DIR" ]] || [[ ! -f "$SCRIPT_DIR/package.json" ]]; then
  TMP_ROOT="$(mktemp -d)"
  ARCHIVE_PATH="$TMP_ROOT/fff.tar.gz"
  EXTRACT_DIR="$TMP_ROOT/extract"
  mkdir -p "$EXTRACT_DIR"

  DOWNLOAD_URL="$ARCHIVE_URL"
  if [[ "$DOWNLOAD_URL" == *\?* ]]; then
    DOWNLOAD_URL+="&cache_bust=$CACHE_BUST"
  else
    DOWNLOAD_URL+="?cache_bust=$CACHE_BUST"
  fi

  log "Downloading fresh source archive"
  curl --fail --silent --show-error --location \
    --header 'Cache-Control: no-cache, no-store, must-revalidate' \
    --header 'Pragma: no-cache' \
    --header 'Expires: 0' \
    "$DOWNLOAD_URL" \
    -o "$ARCHIVE_PATH"

  log "Extracting source archive"
  tar -xzf "$ARCHIVE_PATH" -C "$EXTRACT_DIR"

  SCRIPT_DIR="$(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [[ -z "$SCRIPT_DIR" ]] || [[ ! -f "$SCRIPT_DIR/package.json" ]]; then
    echo "Error: failed to extract installer source." >&2
    exit 1
  fi
fi

log "Building fff"
cd "$SCRIPT_DIR"
bun install --frozen-lockfile
bun build src/index.tsx --outdir dist --target node --external react-devtools-core

STAGE_DIR="${INSTALL_DIR}.stage"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/dist"
cp -f dist/index.js "$STAGE_DIR/dist/"
cp -f package.json "$STAGE_DIR/" 2>/dev/null || true

# Copy yoga.wasm so Ink's bundled layout engine works when moved
if [[ -f "node_modules/yoga-wasm-web/dist/yoga.wasm" ]]; then
  cp -f "node_modules/yoga-wasm-web/dist/yoga.wasm" "$STAGE_DIR/dist/"
fi

if [[ -d "$INSTALL_DIR" ]] && [[ -f "$INSTALL_DIR/.env" ]]; then
  cp "$INSTALL_DIR/.env" "$STAGE_DIR/.env"
  log "$INSTALL_DIR/.env already exists. Keeping existing config"
elif [[ -f "$SCRIPT_DIR/.env" ]]; then
  cp "$SCRIPT_DIR/.env" "$STAGE_DIR/.env"
elif [[ -f "$SCRIPT_DIR/.env.example" ]]; then
  cp "$SCRIPT_DIR/.env.example" "$STAGE_DIR/.env"
  echo
  log "Created $STAGE_DIR/.env from example"
  echo "    EDIT IT AND SET YOUR OPENAI_API_KEY BEFORE RUNNING."
fi

log "Installing to $INSTALL_DIR"
rm -rf "$INSTALL_DIR"
mv "$STAGE_DIR" "$INSTALL_DIR"

mkdir -p "$BIN_DIR"
cat > "$BIN_PATH" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
FFF_HOME="${FFF_INSTALL_DIR:-$HOME/.fff}"
if [[ ! -f "$FFF_HOME/dist/index.js" ]]; then
  echo "Error: fff not found at $FFF_HOME/dist/index.js" >&2
  echo "Re-run the install script." >&2
  exit 1
fi
if [[ -f "$FFF_HOME/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$FFF_HOME/.env"
  set +a
fi
exec bun run "$FFF_HOME/dist/index.js" "$@"
EOF
chmod +x "$BIN_PATH"

echo
log "Installed wrapper to $BIN_PATH"
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo
  echo "WARNING: $BIN_DIR is not in your PATH."
  echo "Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
  echo
  echo "  export PATH=\"$BIN_DIR:\$PATH\""
  echo
  echo "Then reload: source ~/.bashrc  (or ~/.zshrc)"
else
  echo "Run 'fff' from anywhere to start."
fi

echo
log "Done."
