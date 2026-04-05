"use client";

import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  setStreaming: (streaming: boolean) => void;
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => string;
  updateLastAssistantMessage: (content: string) => void;
  appendToLastAssistantMessage: (chunk: string) => void;
  clearMessages: () => void;
}

function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isStreaming: false,

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  addMessage: (msg) => {
    const id = generateId();
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id, timestamp: new Date() },
      ],
    }));
    return id;
  },

  updateLastAssistantMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
          messages[i] = { ...messages[i], content };
          break;
        }
      }
      return { messages };
    }),

  appendToLastAssistantMessage: (chunk) =>
    set((state) => {
      const messages = [...state.messages];
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
          messages[i] = {
            ...messages[i],
            content: messages[i].content + chunk,
          };
          break;
        }
      }
      return { messages };
    }),

  clearMessages: () => set({ messages: [], isStreaming: false }),
}));

export function useSousChef() {
  const {
    messages,
    isStreaming,
    addMessage,
    appendToLastAssistantMessage,
    setStreaming,
    clearMessages,
  } = useChatStore();

  async function sendMessage(content: string) {
    if (!content.trim() || isStreaming) return;

    addMessage({ role: "user", content: content.trim() });

    const history = [
      ...useChatStore.getState().messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    addMessage({ role: "assistant", content: "" });
    setStreaming(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: history }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || `Request failed (${response.status})`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          appendToLastAssistantMessage(chunk);
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Something went wrong";
      appendToLastAssistantMessage(
        `\n\n*Error: ${errorMessage}. Please try again.*`,
      );
    } finally {
      setStreaming(false);
    }
  }

  return { messages, isStreaming, sendMessage, clearChat: clearMessages };
}
