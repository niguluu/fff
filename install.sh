#!/usr/bin/env bash
set -euo pipefail

REPO="git@github.com:niguluu/fff.git"
TMPDIR="$(mktemp -d)"
BIN_DIR="${BIN_DIR:-$HOME/bin}"

cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

echo "Cloning fff..."
git clone --depth 1 "$REPO" "$TMPDIR/fff"

cd "$TMPDIR/fff"

echo "Building fff..."
go build -o fff .

echo "Installing to $BIN_DIR..."
mkdir -p "$BIN_DIR"
cp fff "$BIN_DIR/fff"

echo "fff installed to $BIN_DIR/fff"

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo "WARNING: $BIN_DIR is not in your PATH."
    echo "Add this to your shell profile:"
    echo "  export PATH=\"\$PATH:$BIN_DIR\""
fi
