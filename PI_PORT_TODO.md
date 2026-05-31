# Pi Prompt Box & Scrolling Port — Remaining Work

## Summary

Cloned `pi-mono` to `vendor/pi-mono` as reference. Partially ported pi's `Editor` component visual style and scrolling into the Ink-based `fff` app. Several bugs remain and major pi features are missing.

---

## ✅ Status — Implemented

All items below (1–15) have now been ported. The pi algorithms were extracted and
re-implemented as plain functions / React state (pi components are **not** reused).

New modules:
- `src/text-segmentation.ts` — grapheme/word `Intl.Segmenter` helpers, `prev/nextGraphemeBoundary`, `firstGrapheme`.
- `src/word-navigation.ts` — `findWordBackward` / `findWordForward` (ported).
- `src/kill-ring.ts` — `KillRing` (ported).
- `src/undo-stack.ts` — `UndoStack` (ported).
- `src/paste.ts` — `normalizePaste`, `isLargePaste`, `PasteStore` (paste markers).

Wiring / fixes:
- `src/input-editor.ts` — grapheme-aware `backspaceText` + `deleteForwardText`; kill ops (`killToLineEnd/Start`, `killWordBackward/Forward`).
- `src/pi-prompt-utils.ts` — sticky `preferredVisualCol` in up/down moves + `getCursorVisualCol`.
- `src/use-app-input.ts` — grapheme left/right, word nav (Ctrl/Alt+arrows), kill ring (Ctrl+K/U/W, Alt+Backspace/D), yank (Ctrl+Y), undo (Ctrl+/, Ctrl+_), sticky-column up/down, PageUp/Down paging the prompt on overflow, paste normalization + markers. Copy-assistant rebound from Ctrl+Y → **Ctrl+O**.
- `src/app.tsx` — constant `inputHeight = promptMaxContentHeight + 2`; KillRing/UndoStack/PasteStore/preferredCol refs.
- `src/input-panel.tsx` — empty input flows through the normal `visibleLines` pipeline, fixed-height content box, fake cursor always rendered (grapheme-safe).
- `src/message-viewport.tsx` — inverse-video streaming cursor, minimal dimmed scroll indicators, updated help text.

Verified: `bun run build` succeeds, `tsc` clean for `src/`, and a temporary logic harness asserted 22 cases (grapheme edits, word nav, kill ops, kill ring, undo, sticky-column round-trip, paste) — all passing.

---

## 🔴 Critical Bugs (Breaking)

### 1. Prompt Box Disappears / Does Not Render on Empty State
**File:** `src/input-panel.tsx`
**Issue:** The empty-state rendering (`isEmpty && isIdle`) sometimes fails to display until keystrokes occur. Likely causes:
- `useMemo` dependency array `[input, cursorPos, contentWidth, maxVisibleLines]` recalculates `visibleLines` but the ternary at render time (`isEmpty && isIdle ? ... : isEmpty && !isIdle ? ... : visibleLines.map(...)`) may short-circuit incorrectly on rapid state changes.
- `countVisualLines("", width)` returns `1` (one empty `VisualLine`), but the render path bypasses `visibleLines` entirely when `isEmpty`.
- Ink `Box` with `overflow="hidden"` and dynamic `height` can collapse to zero when parent `msgAreaHeight` recalculates aggressively.

**Fix:**
- Always render at least the border + one content line (even if blank).
- Remove the `isEmpty` ternary; instead feed empty string through the normal `visibleLines` pipeline so layout is stable.
- Memoize `inputHeight` in `app.tsx` to prevent oscillation between `msgAreaHeight` and prompt height.

### 2. Backspace Breaks Prompt Box / Cursor Position
**File:** `src/input-editor.ts` → `backspaceText()`
**Issue:** `backspaceText` does **byte-level** deletion:
```ts
const before = state.input.slice(0, state.cursorPos - 1);  // wrong for multi-byte
```
This corrupts Unicode input (emojis, CJK, combining chars) and causes `cursorPos` to land inside a code unit, desyncing `cursorCol` from `input.length`.

**Fix:**
- Port pi's grapheme-aware deletion from `vendor/pi-mono/packages/tui/src/components/editor.ts`.
- Use `Intl.Segmenter` (grapheme granularity) to find the actual grapheme boundary before cursor.

### 3. Streaming Responses Break Layout
**File:** `src/app.tsx`, `src/input-panel.tsx`
**Issue:** When `status` flips to `"thinking"`, `isIdle = false`. The prompt box switches from inverse-cursor mode to plain text, which is correct. However:
- `msgAreaHeight = termRows - inputHeight - statusHeight` is recalculated every render. If `streamingText` changes cause `MessageViewport` to re-measure, the whole layout shifts.
- `viewport` `useMemo` depends on `msgAreaHeight`, which depends on `inputHeight`, which depends on `countVisualLines(input, ...)`. When `input` is empty after submit, `inputHeight = 3` (1 line + 2 borders). This is stable, but `MessageViewport` height changes can cause scroll jumps.
- The streaming cursor in `MessageViewport` uses `█` (block char) instead of pi-style inverse video.

**Fix:**
- Lock `inputHeight` to `maxVisibleLines + 2` always, so message area has stable height regardless of input content. Pi's Editor does this — it always reserves up to 30% of terminal rows.
- Replace `█` with `<Text inverse> </Text>` in streaming preview.

---

## 🟡 Missing Pi Editor Features

### 4. Grapheme-Aware Cursor Movement
**File:** `src/use-app-input.ts`, `src/input-editor.ts`
**Current:** Left/right arrows move by 1 byte. Backspace deletes 1 byte.
**Pi:** Uses `Intl.Segmenter` for grapheme clusters; arrow keys and backspace respect grapheme boundaries.
**Reference:** `vendor/pi-mono/packages/tui/src/utils.ts` (`getGraphemeSegmenter`), `editor.ts` (`moveCursor`, `handleBackspace`).

### 5. Word Navigation (Ctrl+← / Ctrl+→ / Alt+← / Alt+→)
**File:** `src/use-app-input.ts`
**Current:** Not implemented.
**Pi:** `findWordBackward` / `findWordForward` in `vendor/pi-mono/packages/tui/src/word-navigation.ts`.
**Action:** Port `word-navigation.ts` and wire to Ctrl/Alt arrow keys.

### 6. Kill Ring (Cut/Paste Line/Word)
**File:** `src/use-app-input.ts`
**Current:** Not implemented.
**Pi:** `KillRing` class in `vendor/pi-mono/packages/tui/src/kill-ring.ts`.
- `Ctrl+K` — kill to end of line
- `Ctrl+U` — kill to start of line  
- `Alt+Backspace` — kill word backward
- `Alt+D` — kill word forward
- `Ctrl+Y` — yank (currently bound to copy assistant message; conflict!)

**Action:** Rebind copy-assistant to another key (e.g. `Ctrl+Shift+Y`) and implement kill/yank.

### 7. Undo Stack
**File:** `src/use-app-input.ts`
**Current:** Not implemented.
**Pi:** `UndoStack` in `vendor/pi-mono/packages/tui/src/undo-stack.ts`.
**Action:** Port `UndoStack` and bind to `Ctrl+/` or `Ctrl+_`.

### 8. Sticky Column for Up/Down
**File:** `src/pi-prompt-utils.ts` → `moveCursorUpVisual` / `moveCursorDownVisual`
**Current:** When moving up/down across wrapped lines, column is clamped to target line length. If you move up from a long line to a short line, then back down, you don't return to the original column.
**Pi:** `preferredVisualCol` field in `Editor` state remembers the desired column.
**Reference:** `editor.ts` `computeVerticalMoveColumn` and `moveToVisualLine`.
**Action:** Add `preferredVisualCol` state to `app.tsx` (or derive it in the utility) and implement the full decision table.

### 9. Page Up / Page Down in Prompt
**File:** `src/use-app-input.ts`
**Current:** PageUp/PageDown scroll the *message viewport* only.
**Pi:** When editor has focus, PageUp/PageDown scroll the editor content and move the cursor by page size.
**Action:** Check if prompt has overflow; if so, PageUp/PageDown should scroll prompt instead of (or in addition to) messages.

### 10. Bracketed Paste Handling
**File:** `src/use-app-input.ts`
**Current:** Not implemented. Terminal paste is treated as rapid keypresses.
**Pi:** Detects `\x1b[200~` … `\x1b[201~`, normalizes line endings, filters control chars, handles large pastes with paste markers.
**Reference:** `editor.ts` `handlePaste`.
**Action:** Port paste detection and normalization.

### 11. Multi-Line Paste Markers
**File:** `src/use-app-input.ts`
**Current:** Large multi-line pastes clutter the editor.
**Pi:** Pastes >10 lines or >1000 chars are replaced with `[paste #1 +123 lines]` markers, expanded on submit.
**Action:** Port paste-marker logic.

### 12. Inverse-Video Cursor at End-of-Line
**File:** `src/input-panel.tsx`
**Current:** When cursor is at end of line, an inverse space is rendered. However, when `isIdle === false` (streaming), the cursor disappears entirely instead of showing a static position.
**Pi:** Cursor is always rendered; during non-focused states the `CURSOR_MARKER` APC sequence is omitted but the fake cursor (inverse char) remains.
**Action:** Always render the fake cursor; only omit the zero-width `CURSOR_MARKER` used for IME positioning.

---

## 🟢 Scrolling & Layout Improvements

### 13. Message Viewport Scroll Indicators
**File:** `src/message-viewport.tsx`
**Current:** Uses text arrows (`↑ more above`, `↓ newer below`).
**Pi:** Uses border-integrated scroll indicators or minimal scroll info text.
**Action:** Style to match pi's minimal scroll info (e.g. dimmed `(3/12)` style).

### 14. Smooth Scroll Follow During Streaming
**File:** `src/app.tsx`
**Current:** `shouldAutoScroll(scrollLines <= 1)` snaps to bottom on every chunk.
**Pi:** Auto-scrolls smoothly while user is at bottom; stops scrolling if user has scrolled up manually.
**Action:** Keep current logic but ensure `scrollLines` state doesn't fight with user scroll input.

### 15. Prompt Max Height Should Be Fixed
**File:** `src/app.tsx`
**Current:**
```ts
const inputHeight = Math.min(promptMaxContentHeight, Math.max(1, promptVisualLines)) + 2;
```
This shrinks when input is short, causing message viewport to jump.
**Pi:** Editor container always reserves `maxVisibleLines` of content space.
**Action:**
```ts
const inputHeight = promptMaxContentHeight + 2; // always reserve max space
```
This stabilizes layout.

---

## 📁 Files to Port from Pi (Reference in `vendor/pi-mono`)

| Pi File | What to Extract |
|---------|-----------------|
| `packages/tui/src/components/editor.ts` | Grapheme backspace, sticky column, paste handling, word wrap algorithm |
| `packages/tui/src/utils.ts` | `getGraphemeSegmenter`, `visibleWidth`, `truncateToWidth`, `wrapTextWithAnsi` |
| `packages/tui/src/word-navigation.ts` | `findWordBackward`, `findWordForward` |
| `packages/tui/src/kill-ring.ts` | `KillRing` class |
| `packages/tui/src/undo-stack.ts` | `UndoStack` class |
| `packages/tui/src/keys.ts` | `decodePrintableKey`, `decodeKittyPrintable` for proper key handling |

---

## 🔧 Recommended Implementation Order

1. **Fix `backspaceText`** — grapheme-aware deletion (fixes crash/ corruption).
2. **Fix `inputHeight` to be constant** — prevents layout jumps during streaming.
3. **Fix empty-state rendering** — always render prompt through normal pipeline.
4. **Port grapheme segmenter** — fix left/right arrow + backspace for all Unicode.
5. **Port `KillRing` + `UndoStack`** — add cut/yank/undo.
6. **Port sticky column logic** — polish up/down navigation.
7. **Port bracketed paste** — robust paste handling.
8. **Add word navigation** — Ctrl/Alt arrow keys.
9. **Polish streaming cursor** — inverse video in `MessageViewport`.

---

## 📝 Notes

- `vendor/pi-mono` is in `.gitignore`; it is a local reference only.
- Pi's component model (`render(width): string[]`) is fundamentally different from Ink's React model. Do **not** try to reuse pi components directly. Extract the **algorithms** (word wrap, grapheme segmentation, undo/kill ring) and re-implement them as React state/logic.
- The `useInput` hook from Ink abstracts key events differently than pi's raw stdin buffer. Key handling will need adaptation layer.
