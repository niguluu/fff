import { describe, expect, test } from "bun:test";
import { getAssistantRenderLines, getMessageHeight } from "./message-line";
import { buildViewportModel } from "./viewport";
import type { Message } from "../llm/llm";

describe("assistant render helpers", () => {
  test("wraps streamed assistant text into visible lines", () => {
    expect(getAssistantRenderLines("abcdef", 3)).toEqual(["abc", "def"]);
  });

  test("hides raw streamed tool protocol and replaces it with compact tool status", () => {
    expect(
      getAssistantRenderLines(
        'Plan first\ntool: read_file({"filename":"/tmp/demo.txt"})\nDone',
        80
      )
    ).toEqual(["Plan first", "⚡ read_file /tmp/demo.txt", "Done"]);
  });

  test("hides partial streamed tool protocol while invocation is still being generated", () => {
    expect(getAssistantRenderLines('tool: read_file({"filename":"/tmp', 80)).toEqual([
      "⚡ running tool…",
    ]);
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
  test("uses assistant draft message height directly", () => {
    const model = buildViewportModel({
      messages: [{ role: "assistant", content: "abcdefgh" }],
      termCols: 4,
      msgAreaHeight: 3,
      expandedTools: new Set<number>(),
      scrollLines: 0,
    });

    expect(model.totalContentLines).toBe(2);
    expect(model.maxScroll).toBe(0);
  });

  test("keeps newest assistant content visible when the draft message grows to multiple rows", () => {
    const messages: Message[] = [
      { role: "assistant", content: "one" },
      { role: "assistant", content: "two" },
      { role: "assistant", content: "three" },
      { role: "assistant", content: "abcdefghijk" },
    ];

    const model = buildViewportModel({
      messages,
      termCols: 10,
      msgAreaHeight: 3,
      expandedTools: new Set<number>(),
      scrollLines: 0,
    });

    expect(model.visibleMessages).toEqual(messages.slice(2));
    expect(model.visibleStart).toBe(2);
  });
});