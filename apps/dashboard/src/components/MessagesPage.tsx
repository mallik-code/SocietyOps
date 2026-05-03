import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare, RefreshCw, Wand2, Search, Trash2 } from "lucide-react";
import { useListMessages, useClassifyMessages, useDeleteMessage } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface MessagesPageProps {
  isDark: boolean;
}

export function MessagesPage({ isDark }: MessagesPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: messages, isLoading } = useListMessages();
  const deleteMessage = useDeleteMessage();
  
  const { mutate: classify, isPending: isClassifying } = useClassifyMessages({
    mutation: {
      onSuccess: () => {
        toast({ title: "Messages Classified Successfully!" });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/messages"] });
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
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/messages"] });
      },
      onError: () => {
        toast({ title: "Failed to delete message", variant: "destructive" });
      }
    });
  };

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
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/dashboard/messages"] })}
              className="flex items-center justify-center w-9 h-9 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search bar & filter space */}
        <div className="mb-6 p-4 rounded-xl border border-border bg-card shadow-sm flex items-center gap-3">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search messages..." 
            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Message List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-8 text-muted-foreground">Loading...</div>
          ) : messages && messages.length > 0 ? (
            messages.map((msg) => (
              <div key={msg.id} className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{msg.sender}</span>
                    {msg.group_name && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs font-medium">
                        {msg.group_name}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleString()}
                  </span>
                </div>
                
                <p className="text-foreground text-sm mb-3">{msg.text}</p>
                
                <div className="flex justify-between items-center mt-2 border-t border-border pt-3">
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
            <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-xl">
              No messages found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
