"use client";

import { useEffect, useRef, useCallback, type KeyboardEvent } from "react";
import { useSousChef, type ChatMessage } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Flame,
  SendHorizonal,
  Sparkles,
  Clock,
  ChefHat,
  Trash2,
  User,
} from "lucide-react";

// ─── Minimal markdown renderer ───────────────────────────────────────────────

function renderMarkdown(text: string) {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, bi) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("```recipe-json")) {
      const json = trimmed
        .replace(/^```recipe-json\s*/, "")
        .replace(/```$/, "")
        .trim();
      return (
        <pre
          key={bi}
          className="my-3 overflow-x-auto rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed"
        >
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
            <Sparkles className="size-3" />
            Saveable Recipe
          </div>
          <code>{json}</code>
        </pre>
      );
    }

    if (trimmed.startsWith("```")) {
      const lines = trimmed.split("\n");
      const lang = lines[0].replace("```", "").trim();
      const code = lines
        .slice(1, lines[lines.length - 1] === "```" ? -1 : undefined)
        .join("\n");
      return (
        <pre
          key={bi}
          className="my-3 overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed"
        >
          {lang && (
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {lang}
            </div>
          )}
          <code>{code}</code>
        </pre>
      );
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      const level = trimmed.match(/^(#{1,3})\s/)![1].length;
      const content = trimmed.replace(/^#{1,3}\s+/, "");
      const Tag = `h${level + 1}` as "h2" | "h3" | "h4";
      const sizes: Record<string, string> = {
        h2: "text-lg font-semibold mt-4 mb-1",
        h3: "text-base font-semibold mt-3 mb-1",
        h4: "text-sm font-semibold mt-2 mb-1",
      };
      return (
        <Tag key={bi} className={sizes[Tag]}>
          {content}
        </Tag>
      );
    }

    if (/^[-*]\s/.test(trimmed)) {
      const items = trimmed.split("\n").filter((l) => /^[-*]\s/.test(l.trim()));
      return (
        <ul key={bi} className="my-2 space-y-1 pl-4">
          {items.map((item, ii) => (
            <li key={ii} className="list-disc text-sm leading-relaxed">
              {renderInline(item.replace(/^[-*]\s+/, ""))}
            </li>
          ))}
        </ul>
      );
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const items = trimmed
        .split("\n")
        .filter((l) => /^\d+\.\s/.test(l.trim()));
      return (
        <ol key={bi} className="my-2 space-y-1 pl-4">
          {items.map((item, ii) => (
            <li key={ii} className="list-decimal text-sm leading-relaxed">
              {renderInline(item.replace(/^\d+\.\s+/, ""))}
            </li>
          ))}
        </ol>
      );
    }

    return (
      <p key={bi} className="text-sm leading-relaxed">
        {renderInline(trimmed)}
      </p>
    );
  });
}

function renderInline(text: string) {
  const parts: Array<string | React.ReactElement> = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(
        <strong key={match.index} className="font-semibold">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      parts.push(
        <em key={match.index} className="italic">
          {match[4]}
        </em>,
      );
    } else if (match[5]) {
      parts.push(
        <code
          key={match.index}
          className="rounded bg-muted px-1 py-0.5 text-xs font-mono"
        >
          {match[6]}
        </code>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

// ─── Message bubble ──────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";
  const showCursor = isStreaming && !isUser;

  return (
    <div
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-4`}
    >
      {isUser ? (
        <Avatar size="sm" className="mt-0.5 shrink-0">
          <AvatarFallback>
            <User className="size-3.5" />
          </AvatarFallback>
        </Avatar>
      ) : (
        <Avatar size="sm" className="mt-0.5 shrink-0 bg-primary text-primary-foreground">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <ChefHat className="size-3.5" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={`max-w-[80%] space-y-1 ${isUser ? "items-end text-right" : "items-start"}`}
      >
        <div
          className={`inline-block rounded-2xl px-4 py-2.5 ${
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted rounded-bl-md"
          }`}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          ) : (
            <div className="prose-chat">
              {renderMarkdown(message.content)}
              {showCursor && (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground align-middle" />
              )}
            </div>
          )}
        </div>
        <p
          className={`text-[10px] text-muted-foreground px-2 ${isUser ? "text-right" : "text-left"}`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

// ─── Quick actions ───────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    label: "What should I cook tonight?",
    icon: ChefHat,
  },
  {
    label: "What's expiring soon?",
    icon: Clock,
  },
  {
    label: "Suggest a new technique",
    icon: Sparkles,
  },
];

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ onAction }: { onAction: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
        <Flame className="size-8 text-primary" />
      </div>
      <h2 className="mb-2 text-xl font-semibold tracking-tight">
        Your AI Sous Chef
      </h2>
      <p className="mb-8 max-w-sm text-center text-sm text-muted-foreground leading-relaxed">
        I know your pantry, your flavor preferences, and your cooking style. Ask
        me anything — recipe ideas, technique tips, substitutions, or what to do
        with ingredients about to expire.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onAction(action.label)}
          >
            <action.icon className="size-3.5" />
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function SousChefPage() {
  const { messages, isStreaming, sendMessage, clearChat } = useSousChef();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const value = textarea.value.trim();
    if (!value || isStreaming) return;
    sendMessage(value);
    textarea.value = "";
    textarea.style.height = "auto";
  }, [isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleQuickAction = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage],
  );

  const handleTextareaInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-[calc(100vh-3.5rem-3rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <Flame className="size-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-none">Sous Chef</h1>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {isStreaming ? "Thinking..." : "Your AI cooking assistant"}
            </p>
          </div>
        </div>
        {hasMessages && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={clearChat}
            disabled={isStreaming}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="px-4 py-4">
          {hasMessages ? (
            <>
              {messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={
                    isStreaming && i === messages.length - 1
                  }
                />
              ))}
              <div ref={bottomRef} />
            </>
          ) : (
            <EmptyState onAction={handleQuickAction} />
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t bg-background px-4 pb-4 pt-3">
        {hasMessages && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                disabled={isStreaming}
                onClick={() => handleQuickAction(action.label)}
              >
                <action.icon className="size-3" />
                {action.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={
              isStreaming ? "Sous Chef is responding..." : "Ask your sous chef..."
            }
            disabled={isStreaming}
            onKeyDown={handleKeyDown}
            onInput={handleTextareaInput}
            className="flex-1 resize-none rounded-xl border border-input bg-transparent px-3.5 py-2.5 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            style={{ height: "auto", minHeight: "2.5rem", maxHeight: "10rem" }}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={isStreaming}
            className="shrink-0 rounded-xl"
          >
            <SendHorizonal className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
