/**
 * Minimal theme system replacing @oh-my-pi theme dependencies.
 */

export type ThemeColor =
  | "accent"
  | "border"
  | "borderAccent"
  | "borderMuted"
  | "success"
  | "error"
  | "warning"
  | "muted"
  | "dim"
  | "text"
  | "toolTitle"
  | "toolOutput"
  | "mdHeading"
  | "mdLink"
  | "mdCode"
  | "mdCodeBlock"
  | "mdQuote"
  | "mdQuoteBorder"
  | "mdHr"
  | "mdListBullet"
  | "toolDiffAdded"
  | "toolDiffRemoved"
  | "toolDiffContext"
  | "syntaxComment"
  | "syntaxKeyword"
  | "syntaxFunction"
  | "syntaxVariable"
  | "syntaxString"
  | "syntaxNumber"
  | "syntaxType"
  | "syntaxOperator"
  | "syntaxPunctuation"
  | "thinkingOff"
  | "thinkingMinimal"
  | "thinkingLow"
  | "thinkingMedium"
  | "thinkingHigh"
  | "thinkingXhigh"
  | "bashMode"
  | "pythonMode"
  | "statusLineSep"
  | "statusLineModel"
  | "statusLinePath"
  | "statusLineGitClean"
  | "statusLineGitDirty"
  | "statusLineContext"
  | "statusLineSpend"
  | "statusLineStaged"
  | "statusLineDirty"
  | "statusLineUntracked"
  | "statusLineOutput"
  | "statusLineCost"
  | "statusLineSubagents";

export type ThemeBg =
  | "selectedBg"
  | "userMessageBg"
  | "customMessageBg"
  | "toolPendingBg"
  | "toolSuccessBg"
  | "toolErrorBg"
  | "statusLineBg";

export type SymbolPreset = "unicode" | "ascii";

const COLORS: Record<ThemeColor, string> = {
  accent: "#7aa2f7",
  border: "#565f89",
  borderAccent: "#7aa2f7",
  borderMuted: "#414868",
  success: "#9ece6a",
  error: "#f7768e",
  warning: "#e0af68",
  muted: "#565f89",
  dim: "#414868",
  text: "#c0caf5",
  toolTitle: "#7aa2f7",
  toolOutput: "#a9b1d6",
  mdHeading: "#bb9af7",
  mdLink: "#7aa2f7",
  mdCode: "#e0af68",
  mdCodeBlock: "#c0caf5",
  mdQuoteBorder: "#565f89",
  mdQuote: "#565f89",
  mdHr: "#414868",
  mdListBullet: "#7aa2f7",
  toolDiffAdded: "#9ece6a",
  toolDiffRemoved: "#f7768e",
  toolDiffContext: "#565f89",
  syntaxComment: "#565f89",
  syntaxKeyword: "#bb9af7",
  syntaxFunction: "#7aa2f7",
  syntaxVariable: "#c0caf5",
  syntaxString: "#9ece6a",
  syntaxNumber: "#ff9e64",
  syntaxType: "#e0af68",
  syntaxOperator: "#89ddff",
  syntaxPunctuation: "#a9b1d6",
  thinkingOff: "#565f89",
  thinkingMinimal: "#414868",
  thinkingLow: "#565f89",
  thinkingMedium: "#7aa2f7",
  thinkingHigh: "#bb9af7",
  thinkingXhigh: "#f7768e",
  bashMode: "#9ece6a",
  pythonMode: "#e0af68",
  statusLineSep: "#414868",
  statusLineModel: "#7aa2f7",
  statusLinePath: "#c0caf5",
  statusLineGitClean: "#9ece6a",
  statusLineGitDirty: "#e0af68",
  statusLineContext: "#bb9af7",
  statusLineSpend: "#ff9e64",
  statusLineStaged: "#9ece6a",
  statusLineDirty: "#e0af68",
  statusLineUntracked: "#f7768e",
  statusLineOutput: "#7aa2f7",
  statusLineCost: "#e0af68",
  statusLineSubagents: "#bb9af7",
};

const BG_COLORS: Record<ThemeBg, string> = {
  selectedBg: "#283457",
  userMessageBg: "#1f2335",
  customMessageBg: "#1f2335",
  toolPendingBg: "#1f2335",
  toolSuccessBg: "#1a2a1f",
  toolErrorBg: "#2a1a1f",
  statusLineBg: "#1f2335",
};

const UNICODE_SYMBOLS = {
  "status.success": "✔",
  "status.error": "✘",
  "status.warning": "⚠",
  "status.info": "ⓘ",
  "status.pending": "⏳",
  "status.disabled": "⦸",
  "status.enabled": "●",
  "status.running": "⟳",
  "status.shadowed": "◌",
  "status.aborted": "⏹",
  "nav.cursor": "❯",
  "nav.selected": "➤",
  "nav.expand": "▸",
  "nav.collapse": "▾",
  "nav.back": "⟵",
  "tree.branch": "├─",
  "tree.last": "└─",
  "tree.vertical": "│",
  "tree.horizontal": "─",
  "tree.hook": "└",
  "boxRound.topLeft": "╭",
  "boxRound.topRight": "╮",
  "boxRound.bottomLeft": "╰",
  "boxRound.bottomRight": "╯",
  "boxRound.horizontal": "─",
  "boxRound.vertical": "│",
  "boxSharp.topLeft": "┌",
  "boxSharp.topRight": "┐",
  "boxSharp.bottomLeft": "└",
  "boxSharp.bottomRight": "┘",
  "boxSharp.horizontal": "─",
  "boxSharp.vertical": "│",
  "boxSharp.cross": "┼",
  "boxSharp.teeDown": "┬",
  "boxSharp.teeUp": "┴",
  "boxSharp.teeRight": "├",
  "boxSharp.teeLeft": "┤",
  "sep.powerline": "▕",
  "sep.powerlineThin": "┆",
  "sep.powerlineLeft": "▶",
  "sep.powerlineRight": "◀",
  "sep.powerlineThinLeft": ">",
  "sep.powerlineThinRight": "<",
  "sep.block": "▌",
  "sep.space": " ",
  "sep.asciiLeft": ">",
  "sep.asciiRight": "<",
  "sep.dot": " · ",
  "sep.slash": " / ",
  "sep.pipe": " │ ",
  "icon.model": "⬢",
  "icon.plan": "🗺",
  "icon.goal": "🎯",
  "icon.pause": "⏸",
  "icon.loop": "↻",
  "icon.folder": "📁",
  "icon.scratchFolder": "🗑",
  "icon.file": "📄",
  "icon.git": "⎇",
  "icon.branch": "⑂",
  "icon.pr": "⤴",
  "icon.tokens": "🪙",
  "icon.context": "◫",
  "icon.cost": "💲",
  "icon.time": "⏱",
  "icon.pi": "π",
  "icon.agents": "👥",
  "icon.cache": "💾",
  "icon.input": "⤵",
  "icon.output": "⤴",
  "icon.host": "🖥",
  "icon.session": "🆔",
  "icon.package": "📦",
  "icon.warning": "⚠",
  "icon.rewind": "↶",
  "icon.auto": "⟲",
  "icon.fast": "⚡",
  "icon.extensionSkill": "✦",
  "icon.extensionTool": "🛠",
  "icon.extensionSlashCommand": "⌘",
  "icon.extensionMcp": "🔌",
  "icon.extensionRule": "⚖",
  "icon.extensionHook": "🪝",
  "icon.extensionPrompt": "✎",
  "icon.extensionContextFile": "📎",
  "icon.extensionInstruction": "📘",
  "icon.mic": "🎤",
  "thinking.minimal": "◔ min",
  "thinking.low": "◑ low",
  "thinking.medium": "◒ med",
  "thinking.high": "◕ high",
  "thinking.xhigh": "◉ xhigh",
  "thinking.autoPending": "▣?",
  "checkbox.checked": "☑",
  "checkbox.unchecked": "☐",
  "format.bullet": "•",
  "format.dash": "—",
  "format.bracketLeft": "⟦",
  "format.bracketRight": "⟧",
  "md.quoteBorder": "▏",
  "md.hrChar": "─",
  "md.bullet": "•",
  "md.colorSwatch": "■",
  "lang.default": "⌘",
  "lang.typescript": "🟦",
  "lang.javascript": "🟨",
  "lang.python": "🐍",
  "lang.rust": "🦀",
  "lang.go": "🐹",
  "lang.java": "☕",
  "lang.c": "Ⓒ",
  "lang.cpp": "➕",
  "lang.csharp": "♯",
  "lang.ruby": "💎",
  "lang.php": "🐘",
  "lang.swift": "🕊",
  "lang.kotlin": "🅺",
  "lang.shell": "💻",
  "lang.html": "🌐",
  "lang.css": "🎨",
  "lang.json": "🧾",
  "lang.yaml": "📋",
  "lang.markdown": "📝",
  "lang.sql": "🗄",
  "lang.docker": "🐳",
  "lang.lua": "🌙",
  "lang.text": "🗒",
  "lang.env": "🔧",
  "lang.toml": "🧾",
  "lang.xml": "⟨⟩",
  "lang.ini": "⚙",
  "lang.conf": "⚙",
  "lang.log": "📜",
  "lang.csv": "📑",
  "lang.tsv": "📑",
  "lang.image": "🖼",
  "lang.pdf": "📕",
  "lang.archive": "🗜",
  "lang.binary": "⚙",
  "tab.appearance": "🎨",
  "tab.model": "🤖",
  "tab.interaction": "⌨",
  "tab.context": "📋",
  "tab.editing": "💻",
  "tab.tools": "🔧",
  "tab.memory": "🧠",
  "tab.tasks": "📦",
  "tab.providers": "🌐",
};

const ASCII_SYMBOLS: Record<string, string> = {
  ...Object.fromEntries(Object.keys(UNICODE_SYMBOLS).map((k) => [k, "-"])),
  "tree.branch": "|--",
  "tree.last": "'--",
  "tree.vertical": "|",
  "tree.horizontal": "-",
  "tree.hook": "`-",
  "boxRound.topLeft": "+",
  "boxRound.topRight": "+",
  "boxRound.bottomLeft": "+",
  "boxRound.bottomRight": "+",
  "boxRound.horizontal": "-",
  "boxRound.vertical": "|",
  "boxSharp.topLeft": "+",
  "boxSharp.topRight": "+",
  "boxSharp.bottomLeft": "+",
  "boxSharp.bottomRight": "+",
  "boxSharp.horizontal": "-",
  "boxSharp.vertical": "|",
  "boxSharp.cross": "+",
  "boxSharp.teeDown": "+",
  "boxSharp.teeUp": "+",
  "boxSharp.teeRight": "+",
  "boxSharp.teeLeft": "+",
  "sep.space": " ",
  "sep.dot": " - ",
  "sep.slash": " / ",
  "sep.pipe": " | ",
  "format.bracketLeft": "[",
  "format.bracketRight": "]",
  "md.quoteBorder": "|",
  "md.hrChar": "-",
  "md.bullet": "*",
  "md.colorSwatch": "[]",
};

const SPINNER_FRAMES: Record<SymbolPreset, string[]> = {
  unicode: ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"],
  ascii: ["|", "/", "-", "\\"],
};

function colorToAnsi(color: string): string {
  if (color.startsWith("#")) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `\x1b[38;2;${r};${g};${b}m`;
  }
  return "\x1b[39m";
}

function bgColorToAnsi(color: string): string {
  if (color.startsWith("#")) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `\x1b[48;2;${r};${g};${b}m`;
  }
  return "\x1b[49m";
}

export class Theme {
  #fg: Record<ThemeColor, string>;
  #bg: Record<ThemeBg, string>;
  #symbols: Record<string, string>;
  #preset: SymbolPreset;

  constructor(preset: SymbolPreset = "unicode") {
    this.#preset = preset;
    this.#fg = {} as Record<ThemeColor, string>;
    for (const [k, v] of Object.entries(COLORS)) {
      this.#fg[k as ThemeColor] = colorToAnsi(v);
    }
    this.#bg = {} as Record<ThemeBg, string>;
    for (const [k, v] of Object.entries(BG_COLORS)) {
      this.#bg[k as ThemeBg] = bgColorToAnsi(v);
    }
    this.#symbols = preset === "ascii" ? ASCII_SYMBOLS : UNICODE_SYMBOLS;
  }

  fg(color: ThemeColor, text: string): string {
    const ansi = this.#fg[color];
    if (!ansi) return text;
    return `${ansi}${text}\x1b[39m`;
  }

  bg(color: ThemeBg, text: string): string {
    const ansi = this.#bg[color];
    if (!ansi) return text;
    return `${ansi}${text}\x1b[49m`;
  }

  bold(text: string): string {
    return `\x1b[1m${text}\x1b[22m`;
  }

  italic(text: string): string {
    return `\x1b[3m${text}\x1b[23m`;
  }

  underline(text: string): string {
    return `\x1b[4m${text}\x1b[24m`;
  }

  getFgAnsi(color: ThemeColor): string {
    return this.#fg[color] ?? "\x1b[39m";
  }

  getBgAnsi(color: ThemeBg): string {
    return this.#bg[color] ?? "\x1b[49m";
  }

  getContrastFgAnsi(fillColor: ThemeColor): string {
    const ansi = this.#fg[fillColor];
    const match = ansi ? /38;2;(\d+);(\d+);(\d+)/.exec(ansi) : null;
    if (!match) return this.#fg.text;
    const luma = 0.299 * Number(match[1]) + 0.587 * Number(match[2]) + 0.114 * Number(match[3]);
    return luma > 140 ? "\x1b[38;2;0;0;0m" : "\x1b[38;2;255;255;255m";
  }

  symbol(key: string): string {
    return this.#symbols[key] ?? "";
  }

  styledSymbol(key: string, color: ThemeColor): string {
    return this.fg(color, this.symbol(key));
  }

  getSymbolPreset(): SymbolPreset {
    return this.#preset;
  }

  get status() {
    return {
      success: this.symbol("status.success"),
      error: this.symbol("status.error"),
      warning: this.symbol("status.warning"),
      info: this.symbol("status.info"),
      pending: this.symbol("status.pending"),
      disabled: this.symbol("status.disabled"),
      enabled: this.symbol("status.enabled"),
      running: this.symbol("status.running"),
      shadowed: this.symbol("status.shadowed"),
      aborted: this.symbol("status.aborted"),
    };
  }

  get nav() {
    return {
      cursor: this.symbol("nav.cursor"),
      selected: this.symbol("nav.selected"),
      expand: this.symbol("nav.expand"),
      collapse: this.symbol("nav.collapse"),
      back: this.symbol("nav.back"),
    };
  }

  get tree() {
    return {
      branch: this.symbol("tree.branch"),
      last: this.symbol("tree.last"),
      vertical: this.symbol("tree.vertical"),
      horizontal: this.symbol("tree.horizontal"),
      hook: this.symbol("tree.hook"),
    };
  }

  get boxRound() {
    return {
      topLeft: this.symbol("boxRound.topLeft"),
      topRight: this.symbol("boxRound.topRight"),
      bottomLeft: this.symbol("boxRound.bottomLeft"),
      bottomRight: this.symbol("boxRound.bottomRight"),
      horizontal: this.symbol("boxRound.horizontal"),
      vertical: this.symbol("boxRound.vertical"),
    };
  }

  get boxSharp() {
    return {
      topLeft: this.symbol("boxSharp.topLeft"),
      topRight: this.symbol("boxSharp.topRight"),
      bottomLeft: this.symbol("boxSharp.bottomLeft"),
      bottomRight: this.symbol("boxSharp.bottomRight"),
      horizontal: this.symbol("boxSharp.horizontal"),
      vertical: this.symbol("boxSharp.vertical"),
      cross: this.symbol("boxSharp.cross"),
      teeDown: this.symbol("boxSharp.teeDown"),
      teeUp: this.symbol("boxSharp.teeUp"),
      teeRight: this.symbol("boxSharp.teeRight"),
      teeLeft: this.symbol("boxSharp.teeLeft"),
    };
  }

  get sep() {
    return {
      powerline: this.symbol("sep.powerline"),
      powerlineThin: this.symbol("sep.powerlineThin"),
      powerlineLeft: this.symbol("sep.powerlineLeft"),
      powerlineRight: this.symbol("sep.powerlineRight"),
      powerlineThinLeft: this.symbol("sep.powerlineThinLeft"),
      powerlineThinRight: this.symbol("sep.powerlineThinRight"),
      block: this.symbol("sep.block"),
      space: this.symbol("sep.space"),
      asciiLeft: this.symbol("sep.asciiLeft"),
      asciiRight: this.symbol("sep.asciiRight"),
      dot: this.symbol("sep.dot"),
      slash: this.symbol("sep.slash"),
      pipe: this.symbol("sep.pipe"),
    };
  }

  get icon() {
    return {
      model: this.symbol("icon.model"),
      plan: this.symbol("icon.plan"),
      goal: this.symbol("icon.goal"),
      pause: this.symbol("icon.pause"),
      loop: this.symbol("icon.loop"),
      folder: this.symbol("icon.folder"),
      scratchFolder: this.symbol("icon.scratchFolder"),
      file: this.symbol("icon.file"),
      git: this.symbol("icon.git"),
      branch: this.symbol("icon.branch"),
      pr: this.symbol("icon.pr"),
      tokens: this.symbol("icon.tokens"),
      context: this.symbol("icon.context"),
      cost: this.symbol("icon.cost"),
      time: this.symbol("icon.time"),
      pi: this.symbol("icon.pi"),
      agents: this.symbol("icon.agents"),
      cache: this.symbol("icon.cache"),
      input: this.symbol("icon.input"),
      output: this.symbol("icon.output"),
      host: this.symbol("icon.host"),
      session: this.symbol("icon.session"),
      package: this.symbol("icon.package"),
      warning: this.symbol("icon.warning"),
      rewind: this.symbol("icon.rewind"),
      auto: this.symbol("icon.auto"),
      fast: this.symbol("icon.fast"),
      extensionSkill: this.symbol("icon.extensionSkill"),
      extensionTool: this.symbol("icon.extensionTool"),
      extensionSlashCommand: this.symbol("icon.extensionSlashCommand"),
      extensionMcp: this.symbol("icon.extensionMcp"),
      extensionRule: this.symbol("icon.extensionRule"),
      extensionHook: this.symbol("icon.extensionHook"),
      extensionPrompt: this.symbol("icon.extensionPrompt"),
      extensionContextFile: this.symbol("icon.extensionContextFile"),
      extensionInstruction: this.symbol("icon.extensionInstruction"),
      mic: this.symbol("icon.mic"),
    };
  }

  get thinking() {
    return {
      minimal: this.symbol("thinking.minimal"),
      low: this.symbol("thinking.low"),
      medium: this.symbol("thinking.medium"),
      high: this.symbol("thinking.high"),
      xhigh: this.symbol("thinking.xhigh"),
      autoPending: this.symbol("thinking.autoPending"),
    };
  }

  get checkbox() {
    return {
      checked: this.symbol("checkbox.checked"),
      unchecked: this.symbol("checkbox.unchecked"),
    };
  }

  get format() {
    return {
      bullet: this.symbol("format.bullet"),
      dash: this.symbol("format.dash"),
      bracketLeft: this.symbol("format.bracketLeft"),
      bracketRight: this.symbol("format.bracketRight"),
    };
  }

  get md() {
    return {
      quoteBorder: this.symbol("md.quoteBorder"),
      hrChar: this.symbol("md.hrChar"),
      bullet: this.symbol("md.bullet"),
      colorSwatch: this.symbol("md.colorSwatch"),
    };
  }

  get spinnerFrames(): string[] {
    return SPINNER_FRAMES[this.#preset];
  }

  getLangIcon(lang: string | undefined): string {
    if (!lang) return this.symbol("lang.default");
    const normalized = lang.toLowerCase();
    const key = LANG_MAP[normalized];
    return key ? this.symbol(key) : this.symbol("lang.default");
  }
}

const LANG_MAP: Record<string, string> = {
  typescript: "lang.typescript",
  ts: "lang.typescript",
  tsx: "lang.typescript",
  javascript: "lang.javascript",
  js: "lang.javascript",
  jsx: "lang.javascript",
  mjs: "lang.javascript",
  cjs: "lang.javascript",
  python: "lang.python",
  py: "lang.python",
  rust: "lang.rust",
  rs: "lang.rust",
  go: "lang.go",
  java: "lang.java",
  c: "lang.c",
  cpp: "lang.cpp",
  "c++": "lang.cpp",
  cc: "lang.cpp",
  cxx: "lang.cpp",
  csharp: "lang.csharp",
  cs: "lang.csharp",
  ruby: "lang.ruby",
  rb: "lang.ruby",
  php: "lang.php",
  swift: "lang.swift",
  kotlin: "lang.kotlin",
  kt: "lang.kotlin",
  bash: "lang.shell",
  sh: "lang.shell",
  zsh: "lang.shell",
  fish: "lang.shell",
  powershell: "lang.shell",
  just: "lang.shell",
  shell: "lang.shell",
  html: "lang.html",
  htm: "lang.html",
  astro: "lang.html",
  vue: "lang.html",
  svelte: "lang.html",
  css: "lang.css",
  scss: "lang.css",
  sass: "lang.css",
  less: "lang.css",
  json: "lang.json",
  yaml: "lang.yaml",
  yml: "lang.yaml",
  markdown: "lang.markdown",
  md: "lang.markdown",
  sql: "lang.sql",
  dockerfile: "lang.docker",
  docker: "lang.docker",
  lua: "lang.lua",
  text: "lang.text",
  txt: "lang.text",
  plain: "lang.text",
  log: "lang.log",
  env: "lang.env",
  dotenv: "lang.env",
  toml: "lang.toml",
  xml: "lang.xml",
  ini: "lang.ini",
  conf: "lang.conf",
  cfg: "lang.conf",
  config: "lang.conf",
  properties: "lang.conf",
  csv: "lang.csv",
  tsv: "lang.tsv",
  image: "lang.image",
  img: "lang.image",
  png: "lang.image",
  jpg: "lang.image",
  jpeg: "lang.image",
  gif: "lang.image",
  webp: "lang.image",
  svg: "lang.image",
  ico: "lang.image",
  bmp: "lang.image",
  tiff: "lang.image",
  pdf: "lang.pdf",
  zip: "lang.archive",
  tar: "lang.archive",
  gz: "lang.archive",
  tgz: "lang.archive",
  bz2: "lang.archive",
  xz: "lang.archive",
  "7z": "lang.archive",
  exe: "lang.binary",
  dll: "lang.binary",
  so: "lang.binary",
  dylib: "lang.binary",
  wasm: "lang.binary",
  bin: "lang.binary",
};

export function getLanguageFromPath(filePath: string): string | undefined {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;
  return Object.keys(LANG_MAP).find((k) => k === ext);
}
