# fff

**fff** — *fucking fucking fast* — is a terminal AI coding assistant built with Ink, React, and Bun. It runs in your terminal, can inspect and edit files, run shell commands, and is designed to act like a hands-on coding agent instead of a passive chat bot.

## What it does

- Terminal-first coding assistant UI (gruvbox dark theme)
- Streaming model output
- File tools for reading, listing, editing, and overwriting files
- A `run_command` tool that runs shell commands in their own process group and kills the whole tree on timeout/exit (nothing is left orphaned)
- Agent loop with tool invocation support; stops and reports on failures instead of looping forever
- Per-session agent logs under `~/.fff/logs`
- `fff index` — regenerates `codebase-index.yaml` using the cheapest DeepSeek model
- Scrollback, clipboard copy, and multi-line input
- Install script that bootstraps mise + bun and builds everything

## Requirements

- [Bun](https://bun.sh) (the installer can bootstrap it via [mise](https://mise.jdx.dev) for new users)
- An OpenAI-compatible API key
- Optional clipboard tool:
  - macOS: `pbcopy`
  - Wayland: `wl-copy`
  - X11/Linux: `xclip`

## Install

### Local checkout

```bash
git clone https://github.com/niguluu/fff.git
cd fff
./install.sh
```

### Remote install

```bash
curl -fsSL https://raw.githubusercontent.com/niguluu/fff/main/install.sh | bash
```

The installer:

- bootstraps the toolchain for new users: installs `mise`, then `bun`, then builds (set `FFF_SKIP_BOOTSTRAP=1` to require a pre-installed bun)
- builds the app with Bun
- installs into `~/.fff` by default
- creates a wrapper at `~/.local/bin/fff`
- preserves an existing `~/.fff/.env`
- creates `~/.fff/.env` from `.env.example` when needed
- uses a fresh downloaded archive for remote installs to reduce stale-cache issues

If `~/.local/bin` is not in your `PATH`, add:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Configuration

You can configure fff with environment variables in `~/.fff/.env`.

```bash
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-v4-flash
MAX_TOOL_ROUNDS=100
MAX_CONVERSATION_MESSAGES=40
```

## Usage

Start the installed CLI:

```bash
fff
```

Or run it directly from the repo:

```bash
bun run start
```

## Controls

- `Enter` — send message
- `Shift+Enter` — newline (terminal-encoded Shift+Enter escapes are handled too)
- `↑` / `↓` — history or cursor movement across lines
- `←` / `→` — move cursor (Ctrl/Alt+arrows for word navigation)
- `Page Up` / `Page Down` — scroll conversation (or page the prompt when it overflows)
- `Ctrl+O` — copy last assistant response
- `Ctrl+Y` — yank (paste last killed text)
- `Ctrl+K` / `Ctrl+U` / `Ctrl+W` — kill to line end / line start / word back
- `Ctrl+/` — undo
- `Ctrl+E` — expand/collapse last tool result
- `Ctrl+C` or `Esc` — exit cleanly (kills running commands, restores the terminal)

## Indexing the codebase

```bash
fff index        # or: bun run index
```

Walks the project and writes `codebase-index.yaml` with a one-line summary per file using the cheapest DeepSeek model (`FFF_INDEX_MODEL`, default `deepseek-chat`).

## Development

```bash
bun install
bun x tsc --noEmit
bun run build
bun run dev
```

## Project structure

```text
src/
  agent-runner.ts         Agent loop orchestration
  app.tsx                 Top-level state + composition
  clipboard.ts            Clipboard helper
  config.ts               Runtime constants
  conversation.ts         Conversation pruning
  index.tsx               CLI entry point (TUI + `index` subcommand)
  indexer.ts              Codebase indexer (writes codebase-index.yaml)
  input-editor.ts         Input editing primitives
  input-panel.tsx         Input rendering
  llm.ts                  LLM client, system prompt, tool parsing
  logger.ts               Per-session agent file logging
  message-format.ts       Message formatting helpers
  message-line.tsx        Message row rendering
  message-viewport.tsx    Scrollable message viewport
  process-registry.ts     Tracks/kills spawned child processes
  tools-registry.ts       Tool registry + invocation
  tools.ts                Filesystem + run_command tool implementations
  use-alternate-screen.ts Terminal screen hook (no-op; managed in index.tsx)
  use-app-input.ts        Keyboard input handling
  viewport.ts             Viewport/scroll calculations
```

## Notes

- The app currently bundles with Bun for Node target output.
- The installer stages files before swapping them into place.
- Remote installs are designed to avoid serving stale source archives where possible.

## License

MIT. See `LICENSE`.
