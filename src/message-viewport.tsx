import React from "react";
import { Box, Text } from "ink";
import type { Message } from "./llm.js";
import { ASSISTANT_COLOR, MUTED_COLOR, STATUS_BUSY_COLOR } from "./config.js";
import { FillLines, padToWidth } from "./theme.js";

// While the agent works we deliberately HIDE its raw streaming/tool output.
// The user only wants to see the final, structured result — never the live
// internal token stream (e.g. half-written sentences like "own process group
// and kills the whole t"). So this is intentionally a single, content-free
// status line.
function getStreamingPreview() {
  return ["thinking…"];
}
import { MessageLine } from "./message-line.js";
import type { ViewportModel } from "./viewport.js";

type MessageViewportProps = {
  width: number;
  height: number;
  messages: Message[];
  viewport: ViewportModel;
  expandedTools: Set<number>;
  isConnecting: boolean;
  isStreaming: boolean;
  streamingText: string;
};

export function MessageViewport({
  width,
  height,
  messages,
  viewport,
  expandedTools,
  isConnecting,
  isStreaming,
  streamingText,
}: MessageViewportProps) {
  const { visibleMessages, visibleStart, hasMoreAbove, hasMoreBelow, clampedScroll, maxScroll } =
    viewport;
  const linesAbove = Math.max(0, maxScroll - clampedScroll);
  const streamingLines = isStreaming ? getStreamingPreview() : [];
  const hasMessages = messages.length > 0 || isConnecting || isStreaming;

  // Compute how many themed blank rows we need to fill the empty space ABOVE
  // the transcript so the Gruvbox background paints the whole area (rather than
  // leaving the terminal's default background in the gap). We render exactly the
  // gap — never an overflow — so the flex layout can't shrink real content.
  const visibleMessageLines = viewport.messageHeights
    .slice(viewport.visibleStart)
    .reduce((sum, value) => sum + value, 0);
  let usedLines = visibleMessageLines;
  if (hasMessages && hasMoreAbove) usedLines += 1;
  if (isConnecting && clampedScroll === 0 && !isStreaming) usedLines += 1;
  if (isStreaming && clampedScroll === 0) usedLines += streamingLines.length;
  if (isStreaming && clampedScroll > 0) usedLines += 1;
  if (hasMessages && hasMoreBelow) usedLines += 1;
  const fillCount = Math.max(0, height - usedLines);

  return (
    <Box
      flexDirection="column"
      justifyContent="flex-end"
      height={height}
      width={width}
      overflow="hidden"
    >
      {/* Themed blank rows that fill any empty space above the transcript. They
          are rendered first and clipped from the top by the flex-end + hidden
          overflow, so they paint exactly the gap and never push content. This
          is what makes the Gruvbox background cover the whole screen even on
          terminals that ignore the OSC 11 default-background escape. */}
      <FillLines count={fillCount} width={width} />

      {hasMessages && hasMoreAbove && (
        <Box flexDirection="row" height={1}>
          <Text color={MUTED_COLOR}>{padToWidth(`↑ ${linesAbove}`, width)}</Text>
        </Box>
      )}

      {visibleMessages.map((message, index) => (
        <Box
          key={visibleStart + index}
          flexDirection="column"
          width={width}
          overflow="hidden"
        >
          <MessageLine
            msg={message}
            width={width}
            index={visibleStart + index}
            isExpanded={expandedTools.has(visibleStart + index)}
          />
        </Box>
      ))}

      {isConnecting && clampedScroll === 0 && !isStreaming && (
        <Box flexDirection="row" width={width} overflow="hidden">
          <Text color={ASSISTANT_COLOR}>{padToWidth("...", width)}</Text>
        </Box>
      )}

      {isStreaming && clampedScroll === 0 && (
        <Box flexDirection="column" width={width} overflow="hidden">
          {streamingLines.map((line, index) => (
            <Box key={index} flexDirection="row">
              <Text color={ASSISTANT_COLOR}>{padToWidth(line + " ", width)}</Text>
            </Box>
          ))}
        </Box>
      )}

      {isStreaming && clampedScroll > 0 && (
        <Box flexDirection="row" height={1}>
          <Text color={STATUS_BUSY_COLOR}>{padToWidth("↓ streaming...", width)}</Text>
        </Box>
      )}

      {hasMessages && hasMoreBelow && (
        <Box flexDirection="row" height={1}>
          <Text color={MUTED_COLOR}>{padToWidth(`↓ ${clampedScroll}`, width)}</Text>
        </Box>
      )}
    </Box>
  );
}
