import type { AgentMessage } from "./api";
import type { AgentStep } from "./agent/runAgent";

export type ChatItem =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string }
  | { id: string; kind: "tool"; step: Extract<AgentStep, { kind: "tool" }> }
  | { id: string; kind: "todos"; done: number; total: number }
  | { id: string; kind: "error"; text: string };

export type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  items: ChatItem[];
  history: AgentMessage[];
};

export type ChatStore = {
  activeId: string | null;
  chats: ChatSession[];
};

export function emptyStore(): ChatStore {
  return { activeId: null, chats: [] };
}

export function newSession(partial?: Partial<ChatSession>): ChatSession {
  const now = Date.now();
  return {
    id: `chat-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: "Novo chat",
    createdAt: now,
    updatedAt: now,
    items: [],
    history: [],
    ...partial,
  };
}

export function titleFromText(text: string) {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "Novo chat";
  return t.length > 42 ? `${t.slice(0, 42)}…` : t;
}
