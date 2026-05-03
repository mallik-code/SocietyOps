import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Wand2,
  RefreshCw,
  Tags,
  BarChart3,
  CheckCircle2,
  Circle,
  Search,
} from "lucide-react";
import {
  useListMessages,
  useClassifyMessages,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface ClassificationPageProps {
  isDark: boolean;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Lift:       { bg: "bg-blue-100 dark:bg-blue-900/40",     text: "text-blue-800 dark:text-blue-300",   border: "border-blue-200 dark:border-blue-700" },
  Water:      { bg: "bg-cyan-100 dark:bg-cyan-900/40",     text: "text-cyan-800 dark:text-cyan-300",   border: "border-cyan-200 dark:border-cyan-700" },
  Electrical: { bg: "bg-yellow-100 dark:bg-yellow-900/40", text: "text-yellow-800 dark:text-yellow-300", border: "border-yellow-200 dark:border-yellow-700" },
  Cleaning:   { bg: "bg-green-100 dark:bg-green-900/40",   text: "text-green-800 dark:text-green-300", border: "border-green-200 dark:border-green-700" },
  Noise:      { bg: "bg-orange-100 dark:bg-orange-900/40", text: "text-orange-800 dark:text-orange-300", border: "border-orange-200 dark:border-orange-700" },
  Security:   { bg: "bg-red-100 dark:bg-red-900/40",       text: "text-red-800 dark:text-red-300",     border: "border-red-200 dark:border-red-700" },
  Other:      { bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-800 dark:text-purple-300", border: "border-purple-200 dark:border-purple-700" },
};

function getCategoryStyle(category: string | null | undefined) {
  if (!category) return { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" };
  return CATEGORY_COLORS[category] ?? { bg: "bg-muted", text: "text-foreground", border: "border-border" };
}

export function ClassificationPage({ isDark: _isDark }: ClassificationPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data: messages = [], isLoading } = useListMessages();
  const { mutate: classify, isPending: isClassifying } = useClassifyMessages({
    mutation: {
      onSuccess: () => {
        toast({ title: "Messages classified successfully!" });
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
      },
      onError: () => {
        toast({ title: "Classification failed", variant: "destructive" });
      },
    },
  });

  // Derived stats
  const classified   = messages.filter((m) => m.category).length;
  const unclassified = messages.filter((m) => !m.category).length;

  const categoryCounts = messages.reduce<Record<string, number>>((acc, m) => {
    const key = m.category ?? "Unclassified";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const categories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  const filtered = messages.filter((m) => {
    const matchesSearch =
      !search ||
      m.text.toLowerCase().includes(search.toLowerCase()) ||
      m.sender.toLowerCase().includes(search.toLowerCase()) ||
      (m.group_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !activeCategory || (activeCategory === "Unclassified" ? !m.category : m.category === activeCategory);
    return matchesSearch && matchesCategory;
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
  };

  return (
    <div className="bg-background px-6 pt-8 pb-10 min-h-screen">
      <div className="max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-[28px] leading-none text-foreground flex items-center gap-2">
              <Tags className="w-7 h-7 text-primary" />
              Message Classification
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              AI-powered categorization of incoming WhatsApp messages
            </p>
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
              onClick={handleRefresh}
              className="flex items-center justify-center w-9 h-9 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</span>
            <span className="text-2xl font-bold text-foreground">{messages.length}</span>
            <span className="text-xs text-muted-foreground">messages</span>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Classified</span>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">{classified}</span>
            <span className="text-xs text-muted-foreground">with AI category</span>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Unclassified</span>
            <span className="text-2xl font-bold text-orange-500 dark:text-orange-400">{unclassified}</span>
            <span className="text-xs text-muted-foreground">pending review</span>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Categories</span>
            <span className="text-2xl font-bold text-primary">{categories.length}</span>
            <span className="text-xs text-muted-foreground">distinct labels</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">

          {/* Sidebar — category filter */}
          <aside className="space-y-2">
            <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
              <h2 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-primary" />
                Categories
              </h2>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={() => setActiveCategory(null)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors ${
                      activeCategory === null
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span>All</span>
                    <span className="text-xs font-semibold">{messages.length}</span>
                  </button>
                </li>
                {categories.map(([cat, count]) => {
                  const style = getCategoryStyle(cat === "Unclassified" ? null : cat);
                  return (
                    <li key={cat}>
                      <button
                        onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors ${
                          activeCategory === cat
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className={`inline-block w-2 h-2 rounded-full ${style.bg.split(" ")[0].replace("bg-", "bg-")}`} />
                          {cat}
                        </span>
                        <span className="text-xs font-semibold">{count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* Main content */}
          <div className="space-y-4">
            {/* Search */}
            <div className="p-3 rounded-xl border border-border bg-card shadow-sm flex items-center gap-3">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages, senders, groups..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Message list */}
            {isLoading ? (
              <div className="flex justify-center p-12 text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                No messages match your filter.
              </div>
            ) : (
              filtered.map((msg) => {
                const style = getCategoryStyle(msg.category);
                return (
                  <div
                    key={msg.id}
                    className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{msg.sender}</span>
                        {msg.group_name && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs font-medium">
                            {msg.group_name}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(msg.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-foreground text-sm mb-3 leading-relaxed">{msg.text}</p>

                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      {msg.category ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}
                      >
                        {msg.category ?? "Unclassified"}
                      </span>
                      {msg.confidence && (
                        <div className="ml-auto flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md border border-border">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">AI Confidence</span>
                          <span className={`text-xs font-mono font-bold ${Number(msg.confidence) >= 0.7 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500 dark:text-orange-400'}`}>
                            {(Number(msg.confidence) * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
