import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { BORDER_COLOR, MUTED_COLOR, STATUS_BUSY_COLOR, TEXT_COLOR, YOU_COLOR } from "./config.js";
import { wrapInputToVisualLines } from "./pi-prompt-utils.js";

type InputPanelProps = {
  input: string;
  cursorPos: number;
  width: number;
  termRows: number;
  status: "idle" | "thinking";
};

const PADDING_X = 1;

export function InputPanel({ input, cursorPos, width, termRows, status }: InputPanelProps) {
  const contentWidth = Math.max(1, width - PADDING_X * 2);
  const maxVisibleLines = Math.max(5, Math.floor(termRows * 0.3));
  const isIdle = status === "idle";

  const { visibleLines, scrollOffset, linesBelow } = useMemo(() => {
    const beforeCursor = input.slice(0, cursorPos);
    const cursorLine = beforeCursor.split("\n").length - 1;
    const cursorCol = cursorPos - (input.lastIndexOf("\n", cursorPos - 1) + 1);

    const vlines = wrapInputToVisualLines(input, contentWidth);
    const linesWithCursor = vlines.map((vl) => {
      const isCursorLine = cursorLine === vl.lineIndex && cursorCol >= vl.startCol && cursorCol <= vl.endCol;
      return {
        ...vl,
        isCursorLine,
        cursorOffset: isCursorLine ? cursorCol - vl.startCol : 0,
      };
    });

    const cursorVisualLine = linesWithCursor.findIndex((l) => l.isCursorLine);
    let so = 0;
    if (cursorVisualLine >= maxVisibleLines) {
      so = cursorVisualLine - maxVisibleLines + 1;
    }
    const maxScrollOffset = Math.max(0, linesWithCursor.length - maxVisibleLines);
    so = Math.max(0, Math.min(so, maxScrollOffset));

    const visible = linesWithCursor.slice(so, so + maxVisibleLines);
    const below = linesWithCursor.length - (so + visible.length);

    return { visibleLines: visible, scrollOffset: so, linesBelow: below };
  }, [input, cursorPos, contentWidth, maxVisibleLines]);

  const isEmpty = input.length === 0;
  const topBorder = scrollOffset > 0
    ? `─── ↑ ${scrollOffset} more `
    : "";
  const bottomBorder = linesBelow > 0
    ? `─── ↓ ${linesBelow} more `
    : "";

  function renderLine(
    line: { text: string; lineIndex: number; isCursorLine: boolean; cursorOffset: number },
    lineIdx: number
  ) {
    const prefix = line.lineIndex === 0 && lineIdx === 0 ? "> " : "  ";
    const prefixWidth = prefix.length;
    const availableWidth = Math.max(0, contentWidth - prefixWidth);
    const displayText = line.text.slice(0, availableWidth);

    if (line.isCursorLine && isIdle) {
      const beforeCursor = displayText.slice(0, line.cursorOffset);
      const atCursor = displayText[line.cursorOffset] ?? " ";
      const afterCursor = displayText.slice(line.cursorOffset + 1);

      return (
        <Box flexDirection="row" width={contentWidth} overflow="hidden">
          <Text color={YOU_COLOR} bold>{prefix}</Text>
          <Text color={TEXT_COLOR}>{beforeCursor}</Text>
          <Text inverse>{atCursor}</Text>
          <Text color={TEXT_COLOR}>{afterCursor}</Text>
        </Box>
      );
    }

    return (
      <Box flexDirection="row" width={contentWidth} overflow="hidden">
        <Text color={line.lineIndex === 0 && lineIdx === 0 ? YOU_COLOR : MUTED_COLOR}>
          {prefix}
        </Text>
        <Text color={TEXT_COLOR}>{displayText}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={width} marginTop={1} overflow="hidden">
      {/* Top border */}
      <Box flexDirection="row" width={width} overflow="hidden">
        {scrollOffset > 0 ? (
          <>
            <Text color={BORDER_COLOR}>{topBorder}</Text>
            <Text color={BORDER_COLOR}>{"─".repeat(Math.max(0, width - topBorder.length))}</Text>
          </>
        ) : (
          <Text color={BORDER_COLOR}>{"─".repeat(width)}</Text>
        )}
      </Box>

      {/* Content lines */}
      <Box flexDirection="column" width={width} overflow="hidden">
        {isEmpty && isIdle ? (
          <Box flexDirection="row" width={width} overflow="hidden">
            <Text>{" ".repeat(PADDING_X)}</Text>
            <Box flexDirection="row" width={contentWidth} overflow="hidden">
              <Text color={YOU_COLOR} bold>{"> "}</Text>
              <Text color={MUTED_COLOR} dimColor>Ask fff to inspect, edit, debug, or build…</Text>
              <Text inverse> </Text>
            </Box>
          </Box>
        ) : isEmpty && !isIdle ? (
          <Box flexDirection="row" width={width} overflow="hidden">
            <Text>{" ".repeat(PADDING_X)}</Text>
            <Box flexDirection="row" width={contentWidth} overflow="hidden">
              <Text color={YOU_COLOR} bold>{"> "}</Text>
              <Text color={STATUS_BUSY_COLOR} dimColor>Working…</Text>
            </Box>
          </Box>
        ) : (
          visibleLines.map((line, idx) => (
            <Box key={idx} flexDirection="row" width={width} overflow="hidden">
              <Text>{" ".repeat(PADDING_X)}</Text>
              {renderLine(line, idx)}
            </Box>
          ))
        )}
      </Box>

      {/* Bottom border */}
      <Box flexDirection="row" width={width} overflow="hidden">
        {linesBelow > 0 ? (
          <>
            <Text color={BORDER_COLOR}>{bottomBorder}</Text>
            <Text color={BORDER_COLOR}>{"─".repeat(Math.max(0, width - bottomBorder.length))}</Text>
          </>
        ) : (
          <Text color={BORDER_COLOR}>{"─".repeat(width)}</Text>
        )}
      </Box>
    </Box>
  );
}
