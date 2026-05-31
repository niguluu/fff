import type { Message } from "../llm/llm";
import { getMessageHeight } from "./message-line";

export type ViewportModel = {
  messageHeights: number[];
  totalContentLines: number;
  maxScroll: number;
  clampedScroll: number;
  visibleStart: number;
  visibleMessages: Message[];
  hasMoreAbove: boolean;
  hasMoreBelow: boolean;
};

export function buildViewportModel(args: {
  messages: Message[];
  termCols: number;
  msgAreaHeight: number;
  expandedTools: Set<number>;
  scrollLines: number;
}): ViewportModel {
  const { messages, termCols, msgAreaHeight, expandedTools, scrollLines } = args;

  const messageHeights = messages.map((message, index) =>
    getMessageHeight(message, termCols, expandedTools, index)
  );
  const totalContentLines = messageHeights.reduce((sum, value) => sum + value, 0);
  const maxScroll = Math.max(0, totalContentLines - msgAreaHeight);
  const clampedScroll = Math.min(scrollLines, maxScroll);

  const targetLines = msgAreaHeight + clampedScroll;
  let consumedLines = 0;
  let visibleStart = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    consumedLines += messageHeights[i] ?? 0;
    if (consumedLines >= targetLines) {
      visibleStart = i;
      break;
    }
  }

  return {
    messageHeights,
    totalContentLines,
    maxScroll,
    clampedScroll,
    visibleStart,
    visibleMessages: messages.slice(visibleStart),
    hasMoreAbove: clampedScroll < maxScroll,
    hasMoreBelow: clampedScroll > 0,
  };
}

export function shouldAutoScroll(scrollLines: number) {
  return scrollLines <= 1;
}
