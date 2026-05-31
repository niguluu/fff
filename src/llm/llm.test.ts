import { describe, expect, test } from "bun:test";
import { executeLLMCall, streamLLMCall, type Message } from "./llm";

function createChunkStream(parts: string[], failure?: Error): AsyncIterable<{ choices: Array<{ delta: { content: string } }> }> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const part of parts) {
        yield { choices: [{ delta: { content: part } }] };
      }
      if (failure) throw failure;
    },
  };
}

function createClient(responses: Array<AsyncIterable<any> | Error | { choices: Array<{ message: { content: string } }> }>) {
  let callCount = 0;
  return {
    get callCount() {
      return callCount;
    },
    chat: {
      completions: {
        async create() {
          const response = responses[callCount++];
          if (response instanceof Error) throw response;
          return response!;
        },
      },
    },
  };
}

const baseMessages: Message[] = [{ role: "user", content: "hello" }];

describe("streamLLMCall", () => {
  test("retries a failed stream before any content is emitted", async () => {
    const client = createClient([
      new Error("temporary outage"),
      createChunkStream(["hel", "lo"]),
    ]);
    const waitCalls: number[] = [];
    const events: string[] = [];

    for await (const event of streamLLMCall(baseMessages, {
      client,
      maxRetries: 2,
      sleep: async (ms) => {
        waitCalls.push(ms);
      },
      timeoutMs: 10,
    })) {
      events.push(event.type === "content" ? `${event.type}:${event.delta}` : event.type);
    }

    expect(events).toEqual(["start", "content:hel", "content:lo", "done"]);
    expect(waitCalls).toEqual([1000]);
    expect(client.callCount).toBe(2);
  });

  test("does not retry after partial content has already been emitted", async () => {
    const client = createClient([createChunkStream(["hel"], new Error("stream broke"))]);
    const waitCalls: number[] = [];
    const seen: string[] = [];

    await expect(
      (async () => {
        for await (const event of streamLLMCall(baseMessages, {
          client,
          maxRetries: 3,
          sleep: async (ms) => {
            waitCalls.push(ms);
          },
          timeoutMs: 10,
        })) {
          seen.push(event.type === "content" ? event.delta : event.type);
        }
      })()
    ).rejects.toThrow("stream broke");

    expect(seen).toEqual(["start", "hel"]);
    expect(waitCalls).toEqual([]);
    expect(client.callCount).toBe(1);
  });
});

describe("executeLLMCall", () => {
  test("accumulates streamed deltas into the final response", async () => {
    const client = createClient([createChunkStream(["foo", "bar"])]);
    const chunks: string[] = [];

    const result = await executeLLMCall(baseMessages, (chunk) => {
      chunks.push(chunk);
    }, { client, timeoutMs: 10 });

    expect(chunks).toEqual(["foo", "bar"]);
    expect(result).toBe("foobar");
  });

  test("keeps non-streaming completions working", async () => {
    const client = createClient([
      { choices: [{ message: { content: "plain response" } }] },
    ]);

    await expect(executeLLMCall(baseMessages, undefined, { client, timeoutMs: 10 })).resolves.toBe(
      "plain response"
    );
  });
});