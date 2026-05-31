import { describe, expect, test } from "bun:test";
import { runAgent } from "./agent-runner";
import type { Message, LLMStreamEvent } from "../llm/llm";

function createStream(events: LLMStreamEvent[]) {
  return async function* () {
    for (const event of events) {
      yield event;
    }
  };
}

describe("runAgent", () => {
  test("keeps the submitted prompt visible while the assistant stream fills the same draft message", async () => {
    let messages: Message[] = [];
    const snapshots: Message[][] = [];
    const conversationChanges: Message[][] = [];

    await runAgent({
      conversation: [{ role: "system", content: "sys" }],
      userInput: "ship it",
      setMessages: (value) => {
        messages = typeof value === "function" ? value(messages) : value;
        snapshots.push(messages.map((message) => ({ ...message })));
      },
      onConversationChange: (conversation) => {
        conversationChanges.push(conversation.map((message) => ({ ...message })));
      },
      onStatusChange: () => {},
      onConnectingChange: () => {},
      onAutoScroll: () => {},
      isActiveRef: { current: false },
      stream: createStream([
        { type: "start" },
        { type: "content", delta: "hel", snapshot: "hel" },
        { type: "content", delta: "lo", snapshot: "hello" },
        { type: "done", content: "hello" },
      ]),
    });

    expect(snapshots).toEqual([
      [{ role: "user", content: "ship it" }],
      [
        { role: "user", content: "ship it" },
        { role: "assistant", content: "" },
      ],
      [
        { role: "user", content: "ship it" },
        { role: "assistant", content: "hel" },
      ],
      [
        { role: "user", content: "ship it" },
        { role: "assistant", content: "hello" },
      ],
      [
        { role: "user", content: "ship it" },
        { role: "assistant", content: "hello" },
      ],
    ]);

    expect(messages).toEqual([
      { role: "user", content: "ship it" },
      { role: "assistant", content: "hello" },
    ]);

    expect(conversationChanges.at(-1)).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "ship it" },
      { role: "assistant", content: "hello" },
    ]);
  });
});