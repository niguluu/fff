import type { Message } from "../llm/llm";

export type AppStatus = "idle" | "thinking";

export type Segment = {
  type: "text" | "code" | "thinking";
  content: string;
};

export type InputHistoryState = {
  history: string[];
  historyIndex: number;
  savedInput: string;
};

export type AgentStateRefs = {
  conversation: { current: Message[] };
  isActive: { current: boolean };
};
