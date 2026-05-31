import { useInput } from "ink";
import { extractToolInvocations, type Message } from "./llm.js";
import { parseToolDisplay } from "./message-format.js";
import { copyToClipboard } from "./clipboard.js";
import {
  backspaceText,
  insertText,
  killToLineEnd,
  killToLineStart,
  killWordBackward,
  killWordForward,
  moveCursorToLineEnd,
  moveCursorToLineStart,
  navigateHistoryDown,
  navigateHistoryUp,
  type InputEditorState,
  type InputHistoryRefs,
} from "./input-editor.js";
import {
  getCursorVisualCol,
  getCursorVisualLineIndex,
  getTotalVisualLines,
  moveCursorDownVisual,
  moveCursorUpVisual,
} from "./pi-prompt-utils.js";
import { findWordBackward, findWordForward } from "./word-navigation.js";
import { prevGraphemeBoundary, nextGraphemeBoundary } from "./text-segmentation.js";
import type { KillRing } from "./kill-ring.js";
import type { UndoStack } from "./undo-stack.js";
import type { PasteStore } from "./paste.js";
import { isLargePaste, normalizePaste } from "./paste.js";

type UseAppInputArgs = {
  exit: () => void;
  messages: Message[];
  input: string;
  cursorPos: number;
  status: "idle" | "thinking";
  msgAreaHeight: number;
  promptMaxContentHeight: number;
  termCols: number;
  historyRefs: InputHistoryRefs;
  killRing: KillRing;
  undoStack: UndoStack<InputEditorState>;
  preferredColRef: { current: number | null };
  pasteStore: PasteStore;
  setInput: (value: string) => void;
  setCursorPos: (value: number | ((prev: number) => number)) => void;
  setScrollLines: (value: number | ((prev: number) => number)) => void;
  setExpandedTools: (value: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
  setCopyFeedback: (value: string) => void;
  clearCopyFeedbackLater: () => void;
  onSubmit: (text: string) => void;
};

export function useAppInput(args: UseAppInputArgs) {
  const {
    exit,
    messages,
    input,
    cursorPos,
    status,
    msgAreaHeight,
    promptMaxContentHeight,
    termCols,
    historyRefs,
    killRing,
    undoStack,
    preferredColRef,
    pasteStore,
    setInput,
    setCursorPos,
    setScrollLines,
    setExpandedTools,
    setCopyFeedback,
    clearCopyFeedbackLater,
    onSubmit,
  } = args;

  const promptContentWidth = Math.max(1, termCols - 2);

  // Some terminals (modifyOtherKeys / kitty keyboard protocol) encode
  // Shift+Enter, Ctrl+Enter, etc. as a CSI escape sequence rather than a plain
  // return event. Ink strips the leading ESC and hands us the rest, which used
  // to be inserted verbatim as text (the infamous `[27;2;13~` glitch).
  //
  // Supported encodings for the Enter key (keycode 13):
  //   xterm modifyOtherKeys: ESC [ 27 ; <mods> ; 13 ~
  //   kitty CSI-u:           ESC [ 13 ; <mods> u
  // `mods` is a 1-based bitmask: bit0 = Shift, bit1 = Alt, bit2 = Ctrl.
  function detectEnterEscape(char: string): { shift: boolean } | null {
    const m =
      /\x1b?\[27;(\d+);13~/.exec(char) || /\x1b?\[13;(\d+)u/.exec(char);
    if (!m) return null;
    const mods = Number(m[1]) - 1;
    return { shift: (mods & 1) === 1 };
  }

  // SGR mouse reporting (enabled in src/index.tsx) delivers events as
  // `ESC [ < <button> ; <col> ; <row> (M|m)`. Ink strips the leading ESC, so we
  // see e.g. `[<64;..M` (wheel up) / `[<65;..M` (wheel down) or `[<0;..M`
  // (button press). Returns `"up"`/`"down"` for the wheel, `"other"` for any
  // other mouse event (so it can be swallowed rather than inserted as text), or
  // `null` when the sequence is not a mouse event at all.
  function detectMouseEvent(char: string): "up" | "down" | "other" | null {
    const m = /\x1b?\[<(\d+);\d+;\d+[Mm]/.exec(char);
    if (!m) return null;
    const button = Number(m[1]);
    // Bit 6 (value 64) marks a wheel event; bit 0 selects the direction.
    if ((button & 64) === 0) return "other";
    return (button & 1) === 1 ? "down" : "up";
  }

  function submitInput() {
    if (input.trim().length === 0 && !input.includes("\n")) return;
    const expanded = pasteStore.expand(input);
    setInput("");
    setCursorPos(0);
    historyRefs.history.current.push(expanded);
    historyRefs.historyIndex.current = -1;
    historyRefs.savedInput.current = "";
    undoStack.clear();
    pasteStore.clear();
    preferredColRef.current = null;
    setScrollLines(0);
    onSubmit(expanded);
  }

  // Apply a new editor state, recording an undo snapshot of the current state
  // first. Horizontal edits/moves reset the sticky column.
  function commitEdit(next: InputEditorState, resetPreferredCol = true) {
    undoStack.push({ input, cursorPos });
    setInput(next.input);
    setCursorPos(next.cursorPos);
    if (resetPreferredCol) preferredColRef.current = null;
  }

  function moveCursorTo(pos: number) {
    setCursorPos(pos);
    preferredColRef.current = null;
  }

  useInput((char, key) => {
    // Mouse-wheel scroll: move the transcript viewport instead of cycling the
    // prompt history (which is what happened when the terminal translated the
    // wheel into Up/Down arrows). Keyboard arrows still navigate history.
    if (char && char.length > 1) {
      const mouse = detectMouseEvent(char);
      if (mouse) {
        const WHEEL_STEP = 3;
        if (mouse === "up") {
          setScrollLines((prev) => prev + WHEEL_STEP);
        } else if (mouse === "down") {
          setScrollLines((prev) => Math.max(0, prev - WHEEL_STEP));
        }
        // "other" mouse events (clicks/movement) are swallowed so their escape
        // sequences are never inserted into the prompt as text.
        return;
      }
    }

    if ((key.ctrl && char === "c") || key.escape) {
      exit();
      return;
    }

    // Copy last assistant message (rebound from Ctrl+Y, which is now yank).
    if (key.ctrl && char === "o") {
      const lastAssistant = [...messages]
        .reverse()
        .find(
          (message) =>
            message.role === "assistant" &&
            extractToolInvocations(message.content).invocations.length === 0 &&
            message.content.trim().length > 0
        );
      if (lastAssistant) {
        copyToClipboard(lastAssistant.content);
        setCopyFeedback("copied!");
        clearCopyFeedbackLater();
      }
      return;
    }

    if (key.ctrl && char === "e") {
      const lastToolIdx = messages.findLastIndex((message) => parseToolDisplay(message.content));
      if (lastToolIdx !== -1) {
        setExpandedTools((prev) => {
          const next = new Set(prev);
          if (next.has(lastToolIdx)) next.delete(lastToolIdx);
          else next.add(lastToolIdx);
          return next;
        });
      }
      return;
    }

    if (key.pageUp || key.pageDown) {
      const totalLines = getTotalVisualLines(input, promptContentWidth);
      const promptOverflows = status === "idle" && totalLines > promptMaxContentHeight;
      if (promptOverflows) {
        // Editor has focus and overflows: page the prompt cursor instead of
        // the message viewport.
        if (preferredColRef.current === null) {
          preferredColRef.current = getCursorVisualCol(input, cursorPos, promptContentWidth);
        }
        let pos = cursorPos;
        const move = key.pageUp ? moveCursorUpVisual : moveCursorDownVisual;
        for (let i = 0; i < promptMaxContentHeight; i++) {
          pos = move(input, pos, promptContentWidth, preferredColRef.current ?? undefined);
        }
        setCursorPos(pos);
        return;
      }
      if (key.pageUp) {
        setScrollLines((prev) => prev + Math.floor(msgAreaHeight / 2));
      } else {
        setScrollLines((prev) => Math.max(0, prev - Math.floor(msgAreaHeight / 2)));
      }
      return;
    }

    if (status !== "idle") return;

    // Undo (Ctrl+/ or Ctrl+_ — both arrive as the 0x1f control code).
    if ((key.ctrl && (char === "/" || char === "_")) || char === "\x1f") {
      const prev = undoStack.pop();
      if (prev) {
        setInput(prev.input);
        setCursorPos(prev.cursorPos);
        preferredColRef.current = null;
      }
      return;
    }

    // Terminal-encoded Enter (modifyOtherKeys / kitty). Handle this before the
    // generic text-insertion path so the escape sequence is never inserted.
    if (char && char.length > 1) {
      const enter = detectEnterEscape(char);
      if (enter) {
        if (enter.shift) {
          commitEdit(insertText({ input, cursorPos }, "\n"));
        } else {
          submitInput();
        }
        return;
      }
    }

    if (key.return && !key.shift) {
      submitInput();
      return;
    }

    if (key.return && key.shift) {
      commitEdit(insertText({ input, cursorPos }, "\n"));
      return;
    }

    // Kill word backward (Alt+Backspace).
    if (key.meta && (key.backspace || key.delete)) {
      const result = killWordBackward({ input, cursorPos });
      killRing.push(result.killed, { prepend: true });
      commitEdit(result.state);
      return;
    }

    if (key.backspace || key.delete) {
      commitEdit(backspaceText({ input, cursorPos }));
      return;
    }

    // Kill word forward (Alt+D).
    if (key.meta && char === "d") {
      const result = killWordForward({ input, cursorPos });
      killRing.push(result.killed, { prepend: false });
      commitEdit(result.state);
      return;
    }

    // Word navigation (Ctrl/Alt + arrows).
    if ((key.ctrl || key.meta) && key.leftArrow) {
      moveCursorTo(findWordBackward(input, cursorPos));
      return;
    }
    if ((key.ctrl || key.meta) && key.rightArrow) {
      moveCursorTo(findWordForward(input, cursorPos));
      return;
    }

    if (key.leftArrow) {
      moveCursorTo(prevGraphemeBoundary(input, cursorPos));
      return;
    }

    if (key.rightArrow) {
      moveCursorTo(nextGraphemeBoundary(input, cursorPos));
      return;
    }

    if (key.upArrow) {
      const visualLine = getCursorVisualLineIndex(input, cursorPos, promptContentWidth);
      if (visualLine > 0) {
        if (preferredColRef.current === null) {
          preferredColRef.current = getCursorVisualCol(input, cursorPos, promptContentWidth);
        }
        setCursorPos(
          moveCursorUpVisual(input, cursorPos, promptContentWidth, preferredColRef.current ?? undefined)
        );
        return;
      }
      const historyState = navigateHistoryUp({ input, cursorPos }, historyRefs);
      if (historyState) {
        setInput(historyState.input);
        setCursorPos(historyState.cursorPos);
        preferredColRef.current = null;
      }
      return;
    }

    if (key.downArrow) {
      const visualLine = getCursorVisualLineIndex(input, cursorPos, promptContentWidth);
      const totalLines = getTotalVisualLines(input, promptContentWidth);
      if (visualLine < totalLines - 1) {
        if (preferredColRef.current === null) {
          preferredColRef.current = getCursorVisualCol(input, cursorPos, promptContentWidth);
        }
        setCursorPos(
          moveCursorDownVisual(input, cursorPos, promptContentWidth, preferredColRef.current ?? undefined)
        );
        return;
      }
      const historyState = navigateHistoryDown(historyRefs);
      if (historyState) {
        setInput(historyState.input);
        setCursorPos(historyState.cursorPos);
        preferredColRef.current = null;
      }
      return;
    }

    if (key.ctrl && char === "a") {
      moveCursorTo(moveCursorToLineStart(input, cursorPos));
      return;
    }

    if (key.ctrl && char === "f") {
      moveCursorTo(moveCursorToLineEnd(input, cursorPos));
      return;
    }

    // Kill to end of line (Ctrl+K).
    if (key.ctrl && char === "k") {
      const result = killToLineEnd({ input, cursorPos });
      killRing.push(result.killed, { prepend: false });
      commitEdit(result.state);
      return;
    }

    // Kill to start of line (Ctrl+U).
    if (key.ctrl && char === "u") {
      const result = killToLineStart({ input, cursorPos });
      killRing.push(result.killed, { prepend: true });
      commitEdit(result.state);
      return;
    }

    // Kill word backward (Ctrl+W).
    if (key.ctrl && char === "w") {
      const result = killWordBackward({ input, cursorPos });
      killRing.push(result.killed, { prepend: true });
      commitEdit(result.state);
      return;
    }

    // Yank — paste most recent kill (Ctrl+Y).
    if (key.ctrl && char === "y") {
      const text = killRing.peek();
      if (text) commitEdit(insertText({ input, cursorPos }, text));
      return;
    }

    if (!key.ctrl && !key.meta && char) {
      // A multi-character event is a terminal paste delivered as one chunk.
      if (char.length > 1) {
        const normalized = normalizePaste(char);
        if (!normalized) return;
        const toInsert = isLargePaste(normalized) ? pasteStore.add(normalized) : normalized;
        commitEdit(insertText({ input, cursorPos }, toInsert));
        return;
      }
      commitEdit(insertText({ input, cursorPos }, char));
    }
  });
}
