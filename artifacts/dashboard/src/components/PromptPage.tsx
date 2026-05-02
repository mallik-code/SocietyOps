import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAiConversations,
  useCreateAiConversation,
  useDeleteAiConversation,
  useListAiMessages,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot,
  User,
  Plus,
  Trash2,
  Send,
  Loader2,
  MessageSquare,
  Sparkles,
  ChevronRight,
  StopCircle,
  Copy,
  Check,
  Settings2,
  Database,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface PromptPageProps {
  isDark: boolean;
}

interface ContextMeta {
  tickets: number;
  open_tickets: number;
  high_priority: number;
  groups: number;
  contacts: number;
}

interface StreamMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  context_meta?: ContextMeta;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function GroundingBadge({ meta }: { meta: ContextMeta }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-600 dark:text-violet-400 font-medium w-fit">
      <Database className="w-2.5 h-2.5" />
      <span>
        Grounded with {meta.tickets} tickets
        {meta.open_tickets > 0 && ` (${meta.open_tickets} open`}
        {meta.high_priority > 0 && `, ${meta.high_priority} high-priority`}
        {meta.open_tickets > 0 && ")"}
        {" · "}{meta.groups} groups · {meta.contacts} contacts
      </span>
    </div>
  );
}

function MessageBubble({ msg }: { msg: StreamMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`group flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-gradient-to-br from-violet-500 to-indigo-600 text-white"
        }`}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div className={`flex flex-col gap-1.5 max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`relative rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 prose-code:bg-background/50 prose-code:px-1 prose-code:rounded prose-pre:bg-background/50">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
          {msg.streaming && (
            <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 rounded-sm align-middle" />
          )}
        </div>
        {!isUser && !msg.streaming && msg.content && (
          <div className="flex items-center gap-2 px-1 flex-wrap">
            <CopyBtn text={msg.content} />
            {msg.context_meta && <GroundingBadge meta={msg.context_meta} />}
          </div>
        )}
      </div>
    </div>
  );
}

const STARTER_PROMPTS = [
  "Summarize the most common complaints this week",
  "Which tickets need immediate attention right now?",
  "Draft a response template for water leak complaints",
  "Which block has the most open issues?",
  "List all high-priority unresolved tickets",
];

export function PromptPage({ isDark: _isDark }: PromptPageProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamMessages, setStreamMessages] = useState<StreamMessage[]>([]);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingInputRef = useRef<string | null>(null);

  const { data: conversations, isLoading: convsLoading } = useListAiConversations();
  const { data: savedMessages, isLoading: msgsLoading } = useListAiMessages(
    activeId ?? 0,
    { query: { enabled: activeId !== null } }
  );

  const { mutate: createConv, isPending: creating } = useCreateAiConversation({
    mutation: {
      onSuccess: (conv) => {
        queryClient.invalidateQueries({ queryKey: ["/ai/conversations"] });
        // Safely extract the ID in case the response is nested (e.g., Axios-style { data: { id: ... } }) 
        // or if it's the variables object.
        const newId = (conv as any)?.data?.id ?? (conv as any)?.id;
        if (typeof newId === "number") {
          setActiveId(newId);
        } else {
          console.error("Failed to extract numeric ID from conversation response:", conv);
        }
        setStreamMessages([]);
      },
    },
  });

  const { mutate: deleteConv } = useDeleteAiConversation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/ai/conversations"] });
        setActiveId(null);
        setStreamMessages([]);
      },
    },
  });

  // Sync saved messages to stream messages when conversation changes
  useEffect(() => {
    if (savedMessages) {
      setStreamMessages(
        savedMessages.map((m) => ({
          id: String(m.id),
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    }
  }, [savedMessages]);

  // Auto-send pending input once a conversation is active
  useEffect(() => {
    if (activeId !== null && pendingInputRef.current) {
      const text = pendingInputRef.current;
      pendingInputRef.current = null;
      // Give the state a tick to settle
      setTimeout(() => {
        setInput(text);
      }, 50);
    }
  }, [activeId]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamMessages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  const handleNewChat = useCallback(
    (prefill?: string) => {
      const title = `Chat ${new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}`;
      if (prefill) pendingInputRef.current = prefill;
      createConv({ data: { title } });
    },
    [createConv]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming || !activeId) return;

      const userMsg: StreamMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
      };
      const assistantMsgId = `ai-${Date.now()}`;
      const assistantMsg: StreamMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        streaming: true,
      };

      setStreamMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setStreaming(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: activeId,
            message: text.trim(),
            system_prompt: systemPrompt.trim() || undefined,
          }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) throw new Error("Stream failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;
            try {
              const data = JSON.parse(payload) as {
                content?: string;
                done?: boolean;
                error?: string;
                context_meta?: ContextMeta;
              };
              if (data.error) {
                setStreamMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: `⚠️ ${data.error}`, streaming: false }
                      : m
                  )
                );
                break;
              }
              if (data.content) {
                setStreamMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + data.content }
                      : m
                  )
                );
              }
              if (data.done) {
                setStreamMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, streaming: false, context_meta: data.context_meta }
                      : m
                  )
                );
                queryClient.invalidateQueries({
                  queryKey: ["/ai/conversations", { id: activeId }],
                });
              }
            } catch {}
          }
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          toast({ title: "Failed to get response", variant: "destructive" });
          setStreamMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: "Something went wrong. Please try again.", streaming: false }
                : m
            )
          );
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [activeId, streaming, systemPrompt, queryClient, toast]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const hasMessages = streamMessages.length > 0;

  return (
    <div className="h-[calc(100vh-56px)] flex bg-background overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r border-border flex flex-col bg-muted/30">
        <div className="p-3 border-b border-border">
          <button
            onClick={() => handleNewChat()}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {convsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))
          ) : conversations?.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              No conversations yet
            </div>
          ) : (
            conversations?.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-1 px-2 py-2 rounded-md cursor-pointer transition-colors text-sm ${
                  activeId === conv.id
                    ? "bg-background shadow-sm text-foreground"
                    : "hover:bg-background/60 text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => {
                  setActiveId(conv.id);
                  setStreamMessages([]);
                }}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 truncate text-xs">{conv.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConv({ id: conv.id });
                  }}
                  className="opacity-0 group-hover:opacity-100 shrink-0 w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* RAG info */}
        <div className="px-3 py-2 border-t border-border">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Database className="w-3 h-3 text-violet-500" />
            <span>Live data grounding enabled</span>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-tight">
            Tickets, groups &amp; contacts are fed into every request
          </p>
        </div>

        {/* System prompt toggle */}
        <div className="p-2 border-t border-border">
          <button
            onClick={() => setShowSystemPrompt((s) => !s)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            System prompt
            <ChevronRight
              className={`w-3 h-3 ml-auto transition-transform ${showSystemPrompt ? "rotate-90" : ""}`}
            />
          </button>
          {showSystemPrompt && (
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Override system prompt (optional)..."
              rows={4}
              className="mt-1.5 w-full text-xs rounded-md border border-border bg-background p-2 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-muted-foreground"
            />
          )}
        </div>
      </aside>

      {/* ── Chat area ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeId ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">AI Assistant</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Powered by GPT with live data grounding — asks answered using your real tickets, groups, and contacts.
              </p>
            </div>
            {/* RAG info banner */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-600 dark:text-violet-400 max-w-sm">
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span>All tickets, groups &amp; contacts are automatically included as context in every message</span>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-md">
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => handleNewChat(p)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-background hover:bg-muted text-sm text-left text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={() => handleNewChat()}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Start new chat
            </button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
              {msgsLoading && streamMessages.length === 0 ? (
                <div className="flex justify-center pt-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : !hasMessages ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center pt-20">
                  <Bot className="w-10 h-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Send a message to start the conversation.
                  </p>
                </div>
              ) : (
                streamMessages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div className="border-t border-border bg-background p-3">
              <div className="flex items-end gap-2 max-w-4xl mx-auto">
                <div className="flex-1 relative rounded-xl border border-border bg-muted/40 focus-within:border-primary/50 focus-within:bg-background transition-colors">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything… (Shift+Enter for new line)"
                    disabled={streaming}
                    rows={1}
                    className="w-full px-4 py-3 text-sm bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground disabled:opacity-50 max-h-40"
                    style={{ overflow: "hidden" }}
                  />
                </div>
                {streaming ? (
                  <button
                    onClick={() => abortRef.current?.abort()}
                    className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    title="Stop generation"
                  >
                    <StopCircle className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || streaming}
                    className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Send (Enter)"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-center text-[11px] text-muted-foreground mt-1.5">
                Powered by Replit AI · Live data grounded · Messages saved per conversation
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
