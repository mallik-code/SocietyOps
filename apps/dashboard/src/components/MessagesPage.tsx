import { Fragment, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare, RefreshCw, Wand2, Search, Trash2 } from "lucide-react";
import {
  getListMessagesQueryKey,
  useClassifyMessages,
  useDeleteMessage,
  useListMessages,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface MessagesPageProps {
  isDark: boolean;
}

export function MessagesPage({ isDark }: MessagesPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: messages = [], isFetching, isLoading } = useListMessages({
    query: {
      queryKey: getListMessagesQueryKey(),
      refetchInterval: 5000,
      refetchIntervalInBackground: true,
    },
  });
  const deleteMessage = useDeleteMessage();
  
  const { mutate: classify, isPending: isClassifying } = useClassifyMessages({
    mutation: {
      onSuccess: () => {
        toast({ title: "Messages Classified Successfully!" });
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to classify messages", variant: "destructive" });
      }
    }
  });

  const handleDeleteMessage = (id: number) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    deleteMessage.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Message deleted successfully" });
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to delete message", variant: "destructive" });
      }
    });
  };

  const filteredMessages = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return messages;

    return messages.filter((msg) => {
      return (
        msg.text.toLowerCase().includes(needle) ||
        msg.sender.toLowerCase().includes(needle) ||
        (msg.group_name ?? "").toLowerCase().includes(needle) ||
        (msg.category ?? "").toLowerCase().includes(needle)
      );
    });
  }, [messages, search]);

  return (
    <div className="bg-background px-6 pt-8 pb-10 min-h-screen">
      <div className="max-w-[1400px] mx-auto">
        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-4">
          <div>
            <h1 className="font-bold text-[28px] leading-none text-foreground">WhatsApp Messages</h1>
            <p className="text-muted-foreground mt-2 text-sm">View and classify raw WhatsApp messages</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => classify()}
              disabled={isClassifying}
              className="flex items-center gap-1.5 px-4 h-9 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors rounded-md text-sm font-medium disabled:opacity-50"
            >
              <Wand2 className={`w-4 h-4 ${isClassifying ? "animate-pulse" : ""}`} />
              {isClassifying ? "Classifying..." : "Classify with AI"}
            </button>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() })}
              className="flex items-center justify-center w-9 h-9 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Search bar & filter space */}
        <div className="mb-6 p-4 rounded-md border border-border bg-card shadow-sm flex items-center gap-3">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search messages..." 
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Message List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center p-8 text-muted-foreground">Loading...</div>
          ) : filteredMessages.length > 0 ? (
            filteredMessages.map((msg) => (
              <div key={msg.id} className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
                  <div className="min-w-0 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground break-words">{msg.sender}</span>
                    {msg.group_name && (
                      <span className="max-w-full px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs font-medium break-words">
                        {msg.group_name}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                    {new Date(msg.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="px-4 py-4">
                  <div className="rounded-md border border-border bg-background px-4 py-3 text-[15px] leading-7 text-foreground whitespace-pre-wrap break-words">
                    <FormattedWhatsAppText text={msg.text} />
                  </div>
                </div>

                <div className="flex flex-wrap justify-between items-center gap-3 border-t border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">AI Category:</span>
                    {msg.category ? (
                      <span className="px-2 py-0.5 rounded-md bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 text-xs font-semibold border border-green-200 dark:border-green-800">
                        {msg.category}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs font-medium border border-border">
                        Unclassified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleDeleteMessage(msg.id)}
                      disabled={deleteMessage.isPending}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      View Thread
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-md">
              {messages.length > 0 ? "No messages match your search." : "No messages found."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FormattedWhatsAppText({ text }: { text: string }) {
  return <>{formatWhatsAppText(text)}</>;
}

function formatWhatsAppText(text: string) {
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("```") && part.endsWith("```")) {
      return (
        <code
          key={index}
          className="my-2 block overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-[13px] leading-6 text-foreground"
        >
          {part.slice(3, -3)}
        </code>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px]">
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return <strong key={index}>{part.slice(1, -1)}</strong>;
    }

    if (part.startsWith("_") && part.endsWith("_")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }

    if (part.startsWith("~") && part.endsWith("~")) {
      return <s key={index}>{part.slice(1, -1)}</s>;
    }

    return <Fragment key={index}>{formatLinks(part)}</Fragment>;
  });
}

function formatLinks(text: string) {
  const parts = text.split(/(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+)/gi);

  return parts.map((part, index) => {
    if (!part) return null;

    if (/^(https?:\/\/|www\.)/i.test(part)) {
      const href = part.startsWith("www.") ? `https://${part}` : part;

      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {part}
        </a>
      );
    }

    return <Fragment key={index}>{part}</Fragment>;
  });
}
