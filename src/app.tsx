import { useState, useCallback, useRef, useEffect } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import {
  readFileTool,
  listFilesTool,
  editFileTool,
  atomicOverwriteTool,
} from "./tools.js";
import {
  executeLLMCall,
  extractToolInvocations,
  getSystemPrompt,
  type Message,
} from "./llm.js";

const TOOL_REGISTRY = {
  read_file: readFileTool,
  list_files: listFilesTool,
  edit_file: editFileTool,
  atomic_overwrite: atomicOverwriteTool,
} as const;

type ToolName = keyof typeof TOOL_REGISTRY;

interface ReadFileArgs {
  filename?: string;
  limit?: number;
}
interface ListFilesArgs {
  path?: string;
}
interface EditFileArgs {
  path?: string;
  old_str?: string;
  new_str?: string;
}
interface AtomicOverwriteArgs {
  filename?: string;
  new_content?: string;
  newContent?: string;
}

const TOOL_ARG_PARSERS: Record<ToolName, (args: unknown) => unknown[]> = {
  read_file: (args) => {
    if (typeof args === "string") return [args];
    const a = args as ReadFileArgs;
    const filename = a.filename ?? ".";
    const limit = a.limit;
    return limit !== undefined ? [filename, limit] : [filename];
  },
  list_files: (args) => {
    if (typeof args === "string") return [args];
    const a = args as ListFilesArgs;
    return [a.path ?? "."];
  },
  edit_file: (args) => {
    if (typeof args === "string")
      throw new Error("edit_file requires an object with path, old_str, new_str");
    const a = args as EditFileArgs;
    return [a.path ?? ".", a.old_str ?? "", a.new_str ?? ""];
  },
  atomic_overwrite: (args) => {
    if (typeof args === "string")
      throw new Error(
        "atomic_overwrite requires an object with filename, new_content"
      );
    const a = args as AtomicOverwriteArgs;
    return [a.filename ?? ".", a.new_content ?? a.newContent ?? ""];
  },
};

const SYSTEM_PROMPT = getSystemPrompt();
const YOU_COLOR = "blue";
const ASSISTANT_COLOR = "yellow";
const TOOL_COLOR = "gray";
const ERROR_COLOR = "red";

const MAX_TOOL_ROUNDS = Number(process.env.MAX_TOOL_ROUNDS ?? "20");
const MAX_CONVERSATION_MESSAGES = Number(
  process.env.MAX_CONVERSATION_MESSAGES ?? "40"
);

function pruneMessages(conv: Message[]): Message[] {
  const system = conv.find((m) => m.role === "system");
  const rest = conv.filter((m) => m.role !== "system");
  if (rest.length <= MAX_CONVERSATION_MESSAGES) return conv;
  const pruned = rest.slice(-MAX_CONVERSATION_MESSAGES);
  return system ? [system, ...pruned] : pruned;
}

/* ------------------------------------------------------------------ */
/*  Tool display helpers                                               */
/* ------------------------------------------------------------------ */

function formatToolResultForDisplay(name: string, result: unknown): string {
  return `__tool_result__:${name}:${JSON.stringify(result)}`;
}

function parseToolDisplay(
  content: string
): { name: string; result: unknown } | null {
  if (!content.startsWith("__tool_result__:")) return null;
  const rest = content.slice("__tool_result__:".length);
  const colonIdx = rest.indexOf(":");
  if (colonIdx === -1) return null;
  const name = rest.slice(0, colonIdx);
  const jsonStr = rest.slice(colonIdx + 1);
  try {
    return { name, result: JSON.parse(jsonStr) };
  } catch {
    return null;
  }
}

function summarizeToolDisplay(name: string, result: any): string {
  if (result?.error) return `❌ ${name}: ${result.error}`;
  switch (name) {
    case "read_file": {
      const path = result.file_path ?? "unknown";
      if (result.truncated)
        return `📄 read: ${path} (${result.total_lines} lines, truncated)`;
      return `📄 read: ${path}`;
    }
    case "list_files": {
      const path = result.path ?? "unknown";
      const count = result.files?.length ?? 0;
      return `📁 list: ${path} (${count} items)`;
    }
    case "edit_file": {
      const path = result.path ?? "unknown";
      const action = result.action ?? "done";
      return `✏️ edit: ${path} (${action})`;
    }
    case "atomic_overwrite": {
      const action = result.action ?? "";
      const m = action.match(/Atomically overwrote entire file: (.+)/);
      const path = m ? m[1] : "unknown";
      return `💾 write: ${path}`;
    }
    default:
      return `🔧 ${name}`;
  }
}

function formatToolCallArgs(inv: { name: string; args: unknown }): string {
  const a = inv.args as any;
  switch (inv.name) {
    case "read_file":
      return typeof a === "string" ? a : a?.filename ?? "";
    case "list_files":
      return typeof a === "string" ? a : a?.path ?? "";
    case "edit_file":
      return a?.path ?? "";
    case "atomic_overwrite":
      return a?.filename ?? "";
    default:
      return "";
  }
}

/* ------------------------------------------------------------------ */
/*  Message renderer — no prefixes, role colors only                   */
/* ------------------------------------------------------------------ */

function MessageLine({ msg }: { msg: Message }) {
  const toolDisplay = parseToolDisplay(msg.content);
  const isParseError = msg.content.startsWith("tool_parse_error:");

  if (msg.role === "user" && !toolDisplay && !isParseError) {
    return <Text color={YOU_COLOR}>{msg.content}</Text>;
  }

  if (msg.role === "assistant") {
    const { invocations } = extractToolInvocations(msg.content);
    if (invocations.length > 0) {
      return (
        <Box flexDirection="column">
          {invocations.map((inv, j) => (
            <Box key={j} flexDirection="row">
              <Text color={ASSISTANT_COLOR} bold>{"→ "}</Text>
              <Text color={ASSISTANT_COLOR}>{inv.name}</Text>
              <Text color={TOOL_COLOR}>{" " + formatToolCallArgs(inv)}</Text>
            </Box>
          ))}
        </Box>
      );
    }
    return <Text color={ASSISTANT_COLOR}>{msg.content || "Thinking..."}</Text>;
  }

  if (toolDisplay) {
    const summary = summarizeToolDisplay(toolDisplay.name, toolDisplay.result);
    return <Text color={TOOL_COLOR}>{summary}</Text>;
  }

  if (isParseError) {
    return (
      <Text color={ERROR_COLOR}>
        {"Parse Error: " + msg.content.slice("tool_parse_error: ".length)}
      </Text>
    );
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Alternate screen buffer (vim/htop style)                           */
/* ------------------------------------------------------------------ */

function useAlternateScreen() {
  useEffect(() => {
    if (!process.stdout.isTTY) return;

    const enter = () => process.stdout.write("\x1b[?1049h\x1b[2J\x1b[H");
    const exit = () => process.stdout.write("\x1b[?1049l");

    enter();

    const onSig = () => {
      exit();
      process.exit();
    };
    process.on("SIGINT", onSig);
    process.on("SIGTERM", onSig);

    return () => {
      process.off("SIGINT", onSig);
      process.off("SIGTERM", onSig);
      exit();
    };
  }, []);
}

/* ------------------------------------------------------------------ */

export default function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  useAlternateScreen();

  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "thinking">("idle");
  const [scrollOffset, setScrollOffset] = useState(0);

  const convRef = useRef<Message[]>([
    { role: "system", content: SYSTEM_PROMPT },
  ]);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const savedInputRef = useRef<string>("");
  const activeRef = useRef(false);
  const streamingRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const termRows = stdout.rows || 24;
  const termCols = stdout.columns || 80;

  const INPUT_ROWS = 1;
  const STATUS_ROWS = 1;
  const MSG_AREA_ROWS = Math.max(1, termRows - INPUT_ROWS - STATUS_ROWS);

  /* ---------------------------------------------------------------- */
  /*  Streaming flush (batched for perf)                               */
  /* ---------------------------------------------------------------- */
  const flushChunks = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const text = streamingRef.current;
    if (!text) return;
    streamingRef.current = "";
    setStreamingText((prev) => prev + text);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushChunks();
    }, 24);
  }, [flushChunks]);

  /* ---------------------------------------------------------------- */
  /*  Add message                                                      */
  /* ---------------------------------------------------------------- */
  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Agent runner                                                     */
  /* ---------------------------------------------------------------- */
  const runAgent = useCallback(
    async (userInput: string) => {
      if (activeRef.current) return;
      activeRef.current = true;

      let conv: Message[] = [
        ...convRef.current,
        { role: "user", content: userInput },
      ];
      convRef.current = conv;
      addMessage({ role: "user", content: userInput });
      setScrollOffset(0);
      setStatus("thinking");

      let iteration = 0;

      while (true) {
        if (iteration >= MAX_TOOL_ROUNDS) {
          const limitMsg = `Reached maximum of ${MAX_TOOL_ROUNDS} tool rounds. Stopping to prevent infinite loops.`;
          addMessage({ role: "assistant", content: limitMsg });
          conv = [...conv, { role: "assistant", content: limitMsg }];
          convRef.current = conv;
          break;
        }
        iteration++;

        setIsConnecting(true);
        setIsStreaming(true);
        setStreamingText("");
        streamingRef.current = "";

        let assistantResponse: string;
        try {
          assistantResponse = await executeLLMCall(
            pruneMessages(conv),
            (chunk) => {
              streamingRef.current += chunk;
              scheduleFlush();
            }
          );

          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
          }
          const pending = streamingRef.current;
          streamingRef.current = "";
          if (pending) {
            setStreamingText((prev) => prev + pending);
          }
          setIsConnecting(false);
        } catch (err: any) {
          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
          }
          streamingRef.current = "";
          setIsConnecting(false);
          setStreamingText("");
          setIsStreaming(false);

          const errorMsg = `LLM Error: ${err.message ?? String(err)}`;
          addMessage({ role: "assistant", content: errorMsg });
          conv = [...conv, { role: "assistant", content: errorMsg }];
          convRef.current = conv;
          break;
        }

        if (assistantResponse.trim() === "") {
          assistantResponse = "(received empty response from model)";
        }

        streamingRef.current = "";
        setIsConnecting(false);
        setStreamingText("");
        setIsStreaming(false);

        const { invocations, errors } =
          extractToolInvocations(assistantResponse);

        if (errors.length > 0) {
          for (const err of errors) {
            const errMsg = `tool_parse_error: ${err.error} in line: ${err.raw}`;
            addMessage({ role: "user", content: errMsg });
            conv = [...conv, { role: "user", content: errMsg }];
            convRef.current = conv;
          }
        }

        addMessage({ role: "assistant", content: assistantResponse });
        conv = [...conv, { role: "assistant", content: assistantResponse }];
        convRef.current = conv;

        if (invocations.length === 0) {
          break;
        }

        for (const { name, args } of invocations) {
          const tool = (TOOL_REGISTRY as Record<string, Function>)[name];
          const parser = (TOOL_ARG_PARSERS as Record<string, Function>)[name];
          let resp: unknown;

          if (!tool) {
            resp = { error: `unknown tool: ${name}` };
          } else if (!parser) {
            resp = { error: `no arg parser for tool: ${name}` };
          } else {
            try {
              const parsedArgs = parser(args);
              resp = await tool(...parsedArgs);
            } catch (e: any) {
              resp = { error: e.message ?? String(e) };
            }
          }

          const resultStr = `tool_result(${JSON.stringify(resp)})`;
          conv = [...conv, { role: "user", content: resultStr }];
          convRef.current = conv;

          const displayStr = formatToolResultForDisplay(name, resp);
          addMessage({ role: "user", content: displayStr });
        }
      }

      convRef.current = pruneMessages(convRef.current);
      setStatus("idle");
      activeRef.current = false;
    },
    [addMessage, scheduleFlush]
  );

  /* ---------------------------------------------------------------- */
  /*  Input handling                                                   */
  /* ---------------------------------------------------------------- */
  useInput((char, key) => {
    if (key.return) {
      if (input.trim().length > 0 && status === "idle") {
        const text = input.trim();
        setInput("");
        historyRef.current.push(text);
        historyIndexRef.current = -1;
        savedInputRef.current = "";
        setScrollOffset(0);
        runAgent(text);
      }
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
    } else if ((key.ctrl && char === "c") || key.escape) {
      exit();
    } else if (key.pageUp) {
      setScrollOffset((prev) => prev + 5);
    } else if (key.pageDown) {
      setScrollOffset((prev) => Math.max(0, prev - 5));
    } else if (key.upArrow) {
      if (status !== "idle") return;
      if (historyIndexRef.current === -1) {
        savedInputRef.current = input;
      }
      if (historyIndexRef.current < historyRef.current.length - 1) {
        historyIndexRef.current++;
        const idx = historyRef.current.length - 1 - historyIndexRef.current;
        setInput(historyRef.current[idx]!);
      }
    } else if (key.downArrow) {
      if (status !== "idle") return;
      if (historyIndexRef.current > 0) {
        historyIndexRef.current--;
        const idx = historyRef.current.length - 1 - historyIndexRef.current;
        setInput(historyRef.current[idx]!);
      } else if (historyIndexRef.current === 0) {
        historyIndexRef.current = -1;
        setInput(savedInputRef.current);
      }
    } else if (!key.ctrl && !key.meta && char && status === "idle") {
      setInput((prev) => prev + char);
    }
  });

  /* ---------------------------------------------------------------- */
  /*  Viewport — message-based slice, bottom-aligned                   */
  /* ---------------------------------------------------------------- */
  const clampedScroll = Math.min(scrollOffset, Math.max(0, messages.length - 1));

  const visibleEnd = Math.max(0, messages.length - clampedScroll);
  const visibleStart = Math.max(0, visibleEnd - MSG_AREA_ROWS * 2);
  const visibleMessages = messages.slice(visibleStart, visibleEnd);

  const hasMoreAbove = clampedScroll < messages.length - 1;
  const hasMoreBelow = clampedScroll > 0;

  /* ---------------------------------------------------------------- */
  /*  Input horizontal scroll — cursor always stays on one line        */
  /* ---------------------------------------------------------------- */
  const promptWidth = 2; // "> "
  const cursorWidth = 1; // "█"
  const maxInputVisible = Math.max(
    0,
    termCols - promptWidth - cursorWidth
  );
  const inputScroll = Math.max(0, input.length - maxInputVisible);
  const visibleInput = input.slice(inputScroll);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <Box
      flexDirection="column"
      height={termRows}
      width={termCols}
      overflow="hidden"
    >
      {/* Message area — bottom-aligned, clipped top */}
      <Box
        flexDirection="column"
        justifyContent="flex-end"
        height={MSG_AREA_ROWS}
        width={termCols}
        overflow="hidden"
      >
        {hasMoreAbove && (
          <Box flexDirection="row" height={1}>
            <Text color="gray" dimColor>{"↑ " + (messages.length - visibleEnd) + " more"}</Text>
          </Box>
        )}

        {visibleMessages.map((msg, i) => (
          <Box
            key={visibleStart + i}
            flexDirection="row"
            width={termCols}
            overflow="hidden"
          >
            <MessageLine msg={msg} />
          </Box>
        ))}

        {isConnecting && clampedScroll === 0 && (
          <Box flexDirection="row" width={termCols} overflow="hidden">
            <Text color={ASSISTANT_COLOR} dimColor>{"..."}</Text>
          </Box>
        )}

        {isStreaming && !isConnecting && clampedScroll === 0 && (
          <Box flexDirection="row" width={termCols} overflow="hidden">
            <Text color={ASSISTANT_COLOR}>{streamingText}</Text>
            <Text color="white">{"█"}</Text>
          </Box>
        )}

        {isStreaming && clampedScroll > 0 && (
          <Box flexDirection="row" height={1}>
            <Text color="yellow" dimColor>{"↓ streaming..."}</Text>
          </Box>
        )}
      </Box>

      {/* Input line */}
      <Box
        height={INPUT_ROWS}
        flexDirection="row"
        width={termCols}
        overflow="hidden"
      >
        <Text color={YOU_COLOR} bold>{"> "}</Text>
        <Text>{visibleInput}</Text>
        {status === "idle" && <Text color="white">{"█"}</Text>}
      </Box>

      {/* Status bar */}
      <Box
        height={STATUS_ROWS}
        flexDirection="row"
        width={termCols}
        overflow="hidden"
      >
        <Text color="gray" dimColor>
          {"fff"}
          {status === "thinking" ? " ●" : " ○"}
        </Text>
        <Box flexGrow={1} />
        {clampedScroll > 0 && (
          <Text color="gray" dimColor>
            {"scroll " + clampedScroll}
          </Text>
        )}
        {hasMoreBelow && (
          <Text color="gray" dimColor>
            {" ↓bottom"}
          </Text>
        )}
      </Box>
    </Box>
  );
}
