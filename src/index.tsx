#!/usr/bin/env node

// Handle --version / -v before any imports that pull in heavy deps
const argv = process.argv.slice(2);
if (argv[0] === "--version" || argv[0] === "-v") {
  // Read version directly from package.json without importing anything
  const fs = require("fs");
  const path = require("path");
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"));
    console.log(`fff v${pkg.version}`);
  } catch {
    console.log("fff (unknown version)");
  }
  process.exit(0);
}

import { logger, getLogFile } from "./logger.js";

// Subcommand: `fff index` regenerates codebase-index.yaml and exits without
// ever entering the TUI. Imports are dynamic so the index path does not load
// the interactive app (and its hard API-key requirement).
if (argv[0] === "index") {
  import("./indexer.js")
    .then(({ runIndexer }) => runIndexer())
    .then((path) => {
      console.log(`Wrote ${path}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`Indexing failed: ${err?.message ?? err}`);
      process.exit(1);
    });
} else {
  void startTui();
}

async function startTui() {
  const { render } = await import("ink");
  const React = (await import("react")).default;
  const App = (await import("./app.js")).default;
  const { killAllChildren } = await import("./process-registry.js");
  const isTty = process.stdout.isTTY;

  // Gruvbox dark theme. Ink's <Box> can't paint a background in this version,
  // so we set the terminal's *default* foreground/background via OSC 10/11.
  // This makes the whole screen adopt the theme (including the gaps between
  // text) and is reset on exit with OSC 110/111. Keep these in sync with
  // src/config.ts (GRUVBOX_BG / GRUVBOX_FG).
  const GRUVBOX_BG = "#282828";
  const GRUVBOX_FG = "#ebdbb2";

  // Enter the alternate screen BEFORE Ink's first render. Doing the clear here
  // (instead of in a post-mount effect) means Ink's first frame is never erased
  // — fixing the "UI doesn't appear until I type something" glitch.
  if (isTty) {
    // Parse hex color to RGB for SGR sequences (fallback for terminals that
    // ignore OSC 10/11, like many tmux/VPS setups).
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `${r};${g};${b}`;
    };
    const bgRgb = hexToRgb(GRUVBOX_BG);
    const fgRgb = hexToRgb(GRUVBOX_FG);
    process.stdout.write(
      // OSC 10/11 for terminals that support it
      `\x1b]11;${GRUVBOX_BG}\x07\x1b]10;${GRUVBOX_FG}\x07` +
        // SGR background/foreground as fallback for tmux/VPS
        `\x1b[48;2;${bgRgb}m\x1b[38;2;${fgRgb}m` +
        "\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l" +
        // Enable mouse reporting (button-event tracking + SGR extended coords)
        // so the wheel produces real mouse events instead of being translated
        // into Up/Down arrow keys. That translation made the wheel cycle
        // through prompt history; with explicit reporting we can scroll the
        // transcript viewport instead and keep the arrows for history.
        "\x1b[?1000h\x1b[?1006h"
    );
  }

  logger.info("startup", "fff starting", { log: getLogFile() });

  const { unmount, waitUntilExit } = render(React.createElement(App), {
    exitOnCtrlC: false,
  });

  let cleaned = false;
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    logger.info("shutdown", "cleaning up");
    // Kill any commands the agent left running so they don't detach into the
    // user's session.
    killAllChildren();
    try {
      unmount();
    } catch {
      /* already unmounted */
    }
    if (isTty) {
      // Restore the cursor, disable mouse reporting (?1000/?1006), reset the
      // theme colors we set (OSC 110/111 + SGR reset) and leave the alternate
      // screen so the shell prompt returns to exactly where it was instead of
      // landing somewhere random.
      process.stdout.write(
        "\x1b[?1006l\x1b[?1000l\x1b[?25h\x1b]111\x07\x1b]110\x07\x1b[0m\x1b[?1049l"
      );
    }
  }

  function onSignal(signal: NodeJS.Signals) {
    logger.info("shutdown", `received ${signal}`);
    cleanup();
    process.exit(0);
  }

  process.once("SIGINT", () => onSignal("SIGINT"));
  process.once("SIGTERM", () => onSignal("SIGTERM"));
  process.once("exit", cleanup);
  process.on("uncaughtException", (err) => {
    logger.error("fatal", "uncaughtException", { message: err?.message, stack: err?.stack });
    cleanup();
    process.exit(1);
  });

  void waitUntilExit().then(cleanup);
}
