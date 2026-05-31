import React from "react";
import { Box, Text } from "ink";
import { extractToolInvocations, type Message } from "../llm/llm";
import {
  ERROR_COLOR,
  MUTED_COLOR,
  TEXT_COLOR,
  TOOL_COLOR,
  TOOL_ERROR_COLOR,
  TOOL_LIST_COLOR,
  TOOL_READ_COLOR,
  TOOL_WRITE_COLOR,
  YOU_COLOR,
} from "../core/config";
import { padToWidth } from "./theme";
import {
  formatToolCallArgs,
  parseSegments,
  parseToolDisplay,
  wrapText,
} from "../utils/message-format";

type AssistantRenderLine = {
  color: string;
  text: string;
};

function buildAssistantRenderLines(content: string, width: number): AssistantRenderLine[] {
  if (!content) return [{ color: TEXT_COLOR, text: "Thinking..." }];

  const lines: AssistantRenderLine[] = [];
  for (const segment of parseSegments(content)) {
    if (segment.type === "text") {
      const textLines = wrapText(segment.content, width);
      lines.push(
        ...(textLines.length ? textLines : [""]).map((text) => ({ color: TEXT_COLOR, text }))
      );
      continue;
    }

    if (segment.type === "thinking") {
      lines.push({ color: MUTED_COLOR, text: " [thinking]" });
      const thinkingLines = wrapText(segment.content, Math.max(1, width - 1));
      lines.push(
        ...(thinkingLines.length ? thinkingLines : [""]).map((text) => ({
          color: MUTED_COLOR,
          text: ` ${text}`,
        }))
      );
      continue;
    }

    const codeLines = wrapText(segment.content, Math.max(1, width - 1));
    lines.push(
      ...(codeLines.length ? codeLines : [""]).map((text) => ({
        color: TEXT_COLOR,
        text: ` ${text}`,
      }))
    );
  }

  return lines.length > 0 ? lines : [{ color: TEXT_COLOR, text: "" }];
}

export function getAssistantRenderLines(content: string, width: number): string[] {
  return buildAssistantRenderLines(content, width).map((line) => line.text);
}

export function getMessageHeight(
  message: Message,
  width: number,
  expandedSet: Set<number>,
  index: number
): number {
  const toolDisplay = parseToolDisplay(message.content);
  const isParseError = message.content.startsWith("tool_parse_error:");

  if (toolDisplay) {
    // Collapsed tool results render nothing (errors surface on the tool-call line).
    if (!expandedSet.has(index)) return 0;
    return 1 + wrapText(JSON.stringify(toolDisplay.result, null, 2), width).length;
  }

  if (isParseError) {
    return wrapText(message.content, width).length;
  }

  if (message.role === "assistant") {
    const { invocations } = extractToolInvocations(message.content);
    if (invocations.length > 0) return invocations.length;
    return getAssistantRenderLines(message.content, width).length;
  }

  return wrapText(message.content, width).length || 1;
}

type MessageLineProps = {
  msg: Message;
  width: number;
  index: number;
  isExpanded: boolean;
  messages?: Message[];
};

// For an assistant message at `index` holding tool invocations, the tool
// results are the next consecutive UI messages (one per invocation, in order).
// Returns whether each invocation's result reported an error.
function getInvocationErrors(
  messages: Message[] | undefined,
  index: number,
  count: number
): boolean[] {
  const errors = new Array<boolean>(count).fill(false);
  if (!messages) return errors;
  for (let i = 0; i < count; i++) {
    const result = messages[index + 1 + i];
    if (!result) break;
    const display = parseToolDisplay(result.content);
    if (!display) break;
    errors[i] = !!(display.result as any)?.error;
  }
  return errors;
}

function getToolAccent(name: string, result?: any) {
  if (result?.error) return TOOL_ERROR_COLOR;
  switch (name) {
    case "read_file":
      return TOOL_READ_COLOR;
    case "list_files":
      return TOOL_LIST_COLOR;
    case "edit_file":
    case "atomic_overwrite":
      return TOOL_WRITE_COLOR;
    default:
      return TOOL_COLOR;
  }
}

export function MessageLine({ msg, width, index, isExpanded, messages }: MessageLineProps) {
  const toolDisplay = parseToolDisplay(msg.content);
  const isParseError = msg.content.startsWith("tool_parse_error:");

  if (msg.role === "user" && !toolDisplay && !isParseError) {
    const lines = wrapText(msg.content, width);
    return (
      <Box flexDirection="column">
        {lines.map((line, i) => (
          <Text key={i} color={YOU_COLOR}>
            {padToWidth(line, width)}
          </Text>
        ))}
      </Box>
    );
  }

  if (msg.role === "assistant") {
    const { invocations } = extractToolInvocations(msg.content);
    if (invocations.length > 0) {
      const invocationErrors = getInvocationErrors(messages, index, invocations.length);
      return (
        <Box flexDirection="column">
          {invocations.map((invocation, i) => {
            const hasError = invocationErrors[i];
            const accent = hasError ? TOOL_ERROR_COLOR : getToolAccent(invocation.name);
            const marker = hasError ? "✗ " : "⚡ ";
            return (
              <Box key={i} flexDirection="row">
                <Text color={accent} bold>{marker}</Text>
                <Text color={accent} bold>{invocation.name}</Text>
                <Text color={TOOL_COLOR}>{padToWidth(" " + formatToolCallArgs(invocation), Math.max(0, width - 2 - invocation.name.length))}</Text>
              </Box>
            );
          })}
        </Box>
      );
    }

    if (!msg.content) {
      return (
        <Text color={TEXT_COLOR}>
          {padToWidth("Thinking...", width)}
        </Text>
      );
    }

    const lines = buildAssistantRenderLines(msg.content, width);
    return (
      <Box flexDirection="column">
        {lines.map((line, i) => (
          <Text key={i} color={line.color}>
            {padToWidth(line.text, width)}
          </Text>
        ))}
      </Box>
    );
  }

  if (toolDisplay) {
    const accent = getToolAccent(toolDisplay.name, toolDisplay.result);
    if (isExpanded) {
      const raw = JSON.stringify(toolDisplay.result, null, 2);
      const lines = wrapText(raw, width);
      return (
        <Box flexDirection="column">
          <Text color={accent} bold>{padToWidth(`▾ ${toolDisplay.name}`, width)}</Text>
          {lines.map((line, i) => (
            <Text key={i} color={TOOL_COLOR}>
              {padToWidth(line, width)}
            </Text>
          ))}
        </Box>
      );
    }

    // Collapsed tool results render nothing: success is implicit, and errors are
    // signaled by an ✗ marker on the originating ⚡ tool-call line instead.
    return null;
  }

  if (isParseError) {
    return (
      <Text color={ERROR_COLOR}>
        {padToWidth("Parse Error: " + msg.content.slice("tool_parse_error: ".length), width)}
      </Text>
    );
  }

  return null;
}
