import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  extractToolInvocations,
  type LLMStreamEvent,
  type Message,
  streamLLMCall,
} from "../llm/llm";
import { MAX_TOOL_ROUNDS } from "./config";
import { pruneMessages } from "./conversation";
import { formatToolResultForDisplay } from "../utils/message-format";
import { executeToolInvocation, isReadOnlyTool } from "../tools/tools-registry";
import { logger } from "../utils/logger";

const WORKING_DIR = resolve(process.env.WORKING_DIR || process.cwd());
const MAX_INDEX_CHARS = Number(process.env.FFF_MAX_INDEX_CHARS ?? "60000");
const INDEX_INJECT_EVERY = Number(process.env.FFF_INDEX_INJECT_EVERY ?? "10");

let promptsHandled = 0;

async function loadCodebaseIndex(): Promise<string | null> {
  try {
    const text = await readFile(join(WORKING_DIR, "codebase-index.yaml"), "utf-8");
    if (!text.trim()) return null;
    if (text.length > MAX_INDEX_CHARS) {
      return `${text.slice(0, MAX_INDEX_CHARS)}\n# …[truncated]`;
    }
    return text;
  } catch {
    return null;
  }
}

function withCodebaseIndex(messages: Message[], indexText: string): Message[] {
  const indexMsg: Message = {
    role: "user",
    content: `Here is the current codebase index for context (codebase-index.yaml):\n\n${indexText}`,
  };
  const sysIdx = messages.findIndex((m) => m.role === "system");
  if (sysIdx === -1) return [indexMsg, ...messages];
  return [
    ...messages.slice(0, sysIdx + 1),
    indexMsg,
    ...messages.slice(sysIdx + 1),
  ];
}

export type RunAgentOptions = {
  conversation: Message[];
  userInput: string;
  setMessages: (value: Message[] | ((messages: Message[]) => Message[])) => void;
  onConversationChange: (messages: Message[]) => void;
  onStatusChange: (status: "idle" | "thinking") => void;
  onConnectingChange: (value: boolean) => void;
  onAutoScroll: () => void;
  isActiveRef: { current: boolean };
  stream?: (messages: Message[]) => AsyncIterable<LLMStreamEvent>;
};

export async function runAgent(options: RunAgentOptions) {
  const {
    conversation,
    userInput,
    setMessages,
    onConversationChange,
    onStatusChange,
    onConnectingChange,
    onAutoScroll,
    isActiveRef,
    stream = streamLLMCall,
  } = options;

  const appendMessage = (message: Message) => {
    setMessages((messages) => [...messages, message]);
  };

  const replaceLastMessage = (message: Message) => {
    setMessages((messages) => {
      if (messages.length === 0) return [message];
      return [...messages.slice(0, -1), message];
    });
  };

  if (isActiveRef.current) return conversation;
  isActiveRef.current = true;

  promptsHandled++;
  const shouldInjectIndex = (promptsHandled - 1) % INDEX_INJECT_EVERY === 0;
  let indexText: string | null = null;
  if (shouldInjectIndex) {
    indexText = await loadCodebaseIndex();
    logger.info("agent", "codebase index injection", {
      prompt: promptsHandled,
      attached: indexText !== null,
    });
  }

  let conv: Message[] = [...conversation, { role: "user", content: userInput }];
  onConversationChange(conv);
  appendMessage({ role: "user", content: userInput });
  onAutoScroll();
  onStatusChange("thinking");

  let iteration = 0;

  while (true) {
    if (iteration >= MAX_TOOL_ROUNDS) {
      const limitMsg = `Reached maximum of ${MAX_TOOL_ROUNDS} tool rounds. Stopping to prevent infinite loops.`;
      onMessage({ role: "assistant", content: limitMsg });
      conv = [...conv, { role: "assistant", content: limitMsg }];
      onConversationChange(conv);
      break;
    }
    iteration++;

    onAutoScroll();
    onConnectingChange(true);
    appendMessage({ role: "assistant", content: "" });

    let assistantResponse: string;
    try {
      const llmMessages = indexText
        ? withCodebaseIndex(pruneMessages(conv), indexText)
        : pruneMessages(conv);
      let sawContent = false;
      assistantResponse = "";
      for await (const event of stream(llmMessages)) {
        if (event.type === "start") {
          continue;
        }
        if (event.type === "content") {
          if (!sawContent) {
            sawContent = true;
            onConnectingChange(false);
          }
          assistantResponse = event.snapshot;
          replaceLastMessage({ role: "assistant", content: assistantResponse });
          onAutoScroll();
          continue;
        }
        assistantResponse = event.content;
        replaceLastMessage({ role: "assistant", content: assistantResponse });
      }

      onConnectingChange(false);
    } catch (error: any) {
      onConnectingChange(false);

      const errorMsg = `LLM Error: ${error.message ?? String(error)}`;
      replaceLastMessage({ role: "assistant", content: errorMsg });
      conv = [...conv, { role: "assistant", content: errorMsg }];
      onConversationChange(conv);
      break;
    }

    if (assistantResponse.trim() === "") {
      assistantResponse = "(received empty response from model)";
      replaceLastMessage({ role: "assistant", content: assistantResponse });
    }

    onConnectingChange(false);

    const { invocations, errors } = extractToolInvocations(assistantResponse);

    if (errors.length > 0) {
      for (const error of errors) {
        const errMsg = `tool_parse_error: ${error.error} in line: ${error.raw}`;
        appendMessage({ role: "user", content: errMsg });
        conv = [...conv, { role: "user", content: errMsg }];
        onConversationChange(conv);
      }
    }

    conv = [...conv, { role: "assistant", content: assistantResponse }];
    onConversationChange(conv);

    if (invocations.length === 0) {
      break;
    }

    let index = 0;
    while (index < invocations.length) {
      const invocation = invocations[index]!;

      if (isReadOnlyTool(invocation.name)) {
        const batch = [invocation];
        index++;
        while (index < invocations.length && isReadOnlyTool(invocations[index]!.name)) {
          batch.push(invocations[index]!);
          index++;
        }

        const responses = await Promise.all(
          batch.map(async (item) => ({
            invocation: item,
            response: await executeToolInvocation(item.name, item.args),
          }))
        );

        for (const { invocation: item, response } of responses) {
          conv = [...conv, { role: "user", content: `tool_result(${JSON.stringify(response)})` }];
          onConversationChange(conv);
          appendMessage({
            role: "user",
            content: formatToolResultForDisplay(item.name, response),
          });
        }
        continue;
      }

      const response = await executeToolInvocation(invocation.name, invocation.args);
      conv = [...conv, { role: "user", content: `tool_result(${JSON.stringify(response)})` }];
      onConversationChange(conv);
      appendMessage({
        role: "user",
        content: formatToolResultForDisplay(invocation.name, response),
      });
      index++;
    }
  }

  const prunedConversation = pruneMessages(conv);
  onConversationChange(prunedConversation);
  onStatusChange("idle");
  isActiveRef.current = false;
  return prunedConversation;
}
