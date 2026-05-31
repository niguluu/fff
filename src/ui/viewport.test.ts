import { describe, expect, test } from "bun:test";
import { getAssistantRenderLines, getMessageHeight } from "./message-line";
import { buildViewportModel } from "./viewport";
import type { Message } from "../llm/llm";

describe("assistant render helpers", () => {
  test("wraps streamed assistant text into visible lines", () => {
    expect(getAssistantRenderLines("abcdef", 3)).toEqual(["abc", "def"]);
  });

  test("counts collapsed tool results as zero height", () => {
    const message: Message = {
      role: "user",
      content: '__tool_result__:open:{"path":"/tmp/x"}',
    };

    expect(getMessageHeight(message, 40, new Set<number>(), 0)).toBe(0);
  });
});

describe("buildViewportModel", () => {
  test("uses wrapped streaming height instead of a fixed placeholder row", () => {
    const model = buildViewportModel({
      messages: [],
      termCols: 4,
      msgAreaHeight: 3,
      expandedTools: new Set<number>(),
      scrollLines: 0,
      isStreaming: true,
      streamingText: "abcdefgh",
    });

    expect(model.streamingHeight).toBe(2);
    expect(model.totalContentLines).toBe(2);
    expect(model.maxScroll).toBe(0);
  });

  test("keeps newest assistant content visible when streaming adds multiple rows", () => {
    const messages: Message[] = [
      { role: "assistant", content: "one" },
      { role: "assistant", content: "two" },
      { role: "assistant", content: "three" },
    ];

    const model = buildViewportModel({
      messages,
      termCols: 10,
      msgAreaHeight: 3,
      expandedTools: new Set<number>(),
      scrollLines: 0,
      isStreaming: true,
      streamingText: "abcdefghijk",
    });

    expect(model.streamingHeight).toBe(2);
    expect(model.visibleMessages).toEqual(messages.slice(2));
    expect(model.visibleStart).toBe(2);
  });
});