import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Plus, 
  Upload, 
  Search, 
  FileText, 
  MessageSquare, 
  Sparkles, 
  History, 
  BookMarked,
  ArrowRight,
  Loader2,
  Cloud,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  uploadDocument, 
  searchInCollection, 
  ingestGoogleDriveFile, 
  listDocuments,
  type SearchResult 
} from "@/api/research";

interface Notebook {
  id: string;
  name: string;
}

export default function ResearchPage() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([
    { id: "general", name: "General Research" },
    { id: "bylaws", name: "Society Bylaws" },
  ]);
  const [activeNotebook, setActiveNotebook] = useState<string>("general");
  const [isUploading, setIsUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoadingDocs(true);
    try {
      const docs = await listDocuments(activeNotebook);
      setDocuments(docs);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setIsLoadingDocs(false);
    }
  }, [activeNotebook]);

  useEffect(() => {
    fetchDocuments();
    // Clear chat when switching notebooks
    setChatHistory([]);
  }, [activeNotebook, fetchDocuments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await uploadDocument(file, activeNotebook);
      toast.success(`Uploaded ${file.name} successfully. It's being processed in the background.`);
      // Refresh docs list after a short delay to allow for background processing start
      setTimeout(fetchDocuments, 2000);
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleGoogleDrive = async () => {
    const link = window.prompt("Paste Google Drive Link or File ID:");
    if (!link) return;

    setIsUploading(true);
    try {
      const res = await ingestGoogleDriveFile(link, activeNotebook);
      toast.success(`Ingested ${res.source_name} from Google Drive. Processing...`);
      setTimeout(fetchDocuments, 2000);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Google Drive ingestion failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isSearching) return;

    const userMsg = query;
    setQuery("");
    
    const userMessageObj = { role: "user", content: userMsg };
    const assistantMessageObj = { role: "assistant", content: "", streaming: true };
    
    setChatHistory(prev => [...prev, userMessageObj, assistantMessageObj]);
    setIsSearching(true);

    const conversation_id = 1; 

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id,
          message: userMsg,
          collection_id: activeNotebook,
        }),
      });

      if (!response.ok || !response.body) throw new Error("Stream failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          
          try {
            const data = JSON.parse(payload);
            if (data.content) {
              fullContent += data.content;
              setChatHistory(prev => {
                const newHistory = [...prev];
                const lastIdx = newHistory.length - 1;
                newHistory[lastIdx] = { ...newHistory[lastIdx], content: fullContent };
                return newHistory;
              });
            }
            if (data.done) {
              setChatHistory(prev => {
                const newHistory = [...prev];
                const lastIdx = newHistory.length - 1;
                newHistory[lastIdx] = { 
                  ...newHistory[lastIdx], 
                  streaming: false, 
                  sources: data.sources 
                };
                return newHistory;
              });
            }
          } catch (e) {
            // Partial JSON
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to get an answer");
      setChatHistory(prev => {
        const newHistory = [...prev];
        const lastIdx = newHistory.length - 1;
        newHistory[lastIdx] = { ...newHistory[lastIdx], content: "⚠️ Error: Failed to connect to AI service.", streaming: false };
        return newHistory;
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-background">
      {/* Left Sidebar - Notebooks */}
      <aside className="w-64 border-r border-border bg-muted/30 flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Notebooks
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {notebooks.map(nb => (
            <button
              key={nb.id}
              onClick={() => setActiveNotebook(nb.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                activeNotebook === nb.id 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <BookMarked className="w-4 h-4" />
              {nb.name}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">{notebooks.find(n => n.id === activeNotebook)?.name}</h1>
            <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
              Research Mode
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUpload}
              className="hidden"
              accept=".pdf,.docx,.txt,.xlsx"
            />
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2" 
              onClick={handleGoogleDrive}
              disabled={isUploading}
            >
              <Cloud className="w-4 h-4 text-blue-500" />
              Google Drive
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload Document
            </Button>
          </div>
        </header>

        {/* Layout with Chat and Sources */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {chatHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Welcome to your Research Hub</h2>
                  <p className="text-muted-foreground mb-8">
                    Upload your society documents, bylaws, or reports. Ask questions and get answers grounded strictly in your data.
                  </p>
                  <div className="grid grid-cols-1 gap-3 w-full">
                    <button className="p-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-left text-sm flex items-center gap-3">
                      <div className="p-1.5 bg-blue-500/10 rounded-lg"><FileText className="w-4 h-4 text-blue-500" /></div>
                      "What are the rules for visitor parking?"
                    </button>
                    <button className="p-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-left text-sm flex items-center gap-3">
                      <div className="p-1.5 bg-green-500/10 rounded-lg"><FileText className="w-4 h-4 text-green-500" /></div>
                      "Summarize the latest maintenance audit report."
                    </button>
                  </div>
                </div>
              ) : (
                chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted/50 border border-border'
                    }`}>
                      <div className="flex items-center gap-2 mb-2 opacity-70 text-[10px] font-bold uppercase tracking-widest">
                        {msg.role === 'user' ? <History className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                        {msg.role === 'user' ? 'You' : 'Assistant'}
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {msg.content}
                      </div>
                      {msg.sources && (
                        <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-2">
                          {msg.sources.map((s: any, j: number) => (
                            <div key={j} className="flex items-center gap-1.5 px-2 py-1 rounded bg-background text-[10px] border border-border">
                              <FileText className="w-3 h-3" />
                              {s.source_name} (p.{s.page_number})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isSearching && (
                <div className="flex justify-start">
                  <div className="bg-muted/50 border border-border p-4 rounded-2xl flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground italic">Analyzing documents...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-6 bg-gradient-to-t from-background to-transparent">
              <form onSubmit={handleAsk} className="max-w-3xl mx-auto relative group">
                <div className="absolute inset-0 bg-primary/5 blur-xl group-focus-within:bg-primary/10 transition-colors rounded-full" />
                <div className="relative flex items-center p-1.5 bg-card border border-border rounded-2xl shadow-xl">
                  <div className="pl-4 pr-2 text-muted-foreground">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={`Ask anything about ${notebooks.find(n => n.id === activeNotebook)?.name}...`}
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm py-3"
                  />
                  <Button type="submit" size="icon" className="rounded-xl h-10 w-10 shrink-0 ml-2" disabled={isSearching}>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Sidebar - Sources (NotebookLM Style) */}
          <aside className="w-80 border-l border-border bg-muted/30 flex flex-col">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <h2 className="font-semibold text-sm">Sources</h2>
              <span className="ml-auto bg-muted px-2 py-0.5 rounded text-[10px] font-bold">{documents.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingDocs ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground italic text-xs gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading sources...
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-10 px-6">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">No sources added yet. Upload a document to get started.</p>
                </div>
              ) : (
                documents.map((doc, idx) => (
                  <div 
                    key={idx} 
                    className="group p-3 rounded-xl border border-border bg-card hover:border-primary/50 transition-all cursor-default"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-2 bg-primary/5 rounded-lg text-primary">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate mb-1" title={doc.source_name}>
                          {doc.source_name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                          Document ID: {doc.document_id?.substring(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
