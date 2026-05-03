import { useEffect, useState } from "react";
import { Search, Plus, ArrowLeft, BookOpen } from "lucide-react";
import { fetchCategories, createCategory, searchKnowledge, type Category } from "@/api/knowledge";
import CategoryCard from "@/components/CategoryCard";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import "@/styles/knowledge-bank.css";

export default function KnowledgeBankPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [isTopicsLoading, setIsTopicsLoading] = useState(false);

  const loadCategories = () => {
    setIsLoading(true);
    fetchCategories(query).then(data => {
      setCategories(data);
      setIsLoading(false);
    }).catch(err => {
      console.error(err);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    if (!selectedCategory) {
      const timer = setTimeout(() => {
        loadCategories();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [query, selectedCategory]);

  useEffect(() => {
    if (selectedCategory) {
      setIsTopicsLoading(true);
      searchKnowledge(selectedCategory, 20).then(data => {
        setTopics(data);
        setIsTopicsLoading(false);
      }).catch(err => {
        console.error(err);
        setIsTopicsLoading(false);
        toast.error("Failed to load topics");
      });
    }
  }, [selectedCategory]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Category name is required");
      return;
    }

    setIsCreating(true);
    try {
      await createCategory({
        name: newCategoryName,
        description: newCategoryDesc,
      });
      toast.success("Category created successfully");
      setIsDialogOpen(false);
      setNewCategoryName("");
      setNewCategoryDesc("");
      loadCategories();
    } catch (error) {
      console.error("Error creating category:", error);
      toast.error("Failed to create category");
    } finally {
      setIsCreating(false);
    }
  };

  if (selectedCategory) {
    return (
      <main className="kb-page">
        <header className="kb-header">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSelectedCategory(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1>{selectedCategory}</h1>
          </div>
        </header>

        <section className="kb-topics mt-8">
          {isTopicsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : topics.length ? (
            <div className="space-y-4">
              {topics.map((topic, i) => (
                <div key={topic.id || i} className="kb-topic-card p-6 bg-card border border-border rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-foreground leading-relaxed">{topic.content}</p>
                      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                        <span>Updated: {new Date(topic.created_at).toLocaleDateString()}</span>
                        {topic.rrf_score && <span>Relevance: {(topic.rrf_score * 100).toFixed(1)}%</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No topics found in this category.</p>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="kb-page">
      <header className="kb-header">
        <div className="flex items-center justify-between w-full">
          <h1>Knowledge Bank</h1>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Category
          </Button>
        </div>
        <div className="kb-search-container mt-4">
          <Search className="kb-search-icon w-4 h-4" />
          <input
            type="search"
            placeholder="Search knowledge..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="kb-search"
          />
        </div>
      </header>

      <section className="kb-grid">
        {isLoading ? (
          // Simple loading skeleton
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="kb-card animate-pulse">
              <div className="w-10 h-10 bg-muted rounded-lg mb-4" />
              <div className="h-5 bg-muted rounded w-3/4 mb-4" />
              <div className="h-4 bg-muted rounded w-full mb-2" />
              <div className="h-4 bg-muted rounded w-5/6 mb-6" />
              <div className="flex justify-between pt-4 border-t border-border">
                <div className="h-3 bg-muted rounded w-1/4" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
            </div>
          ))
        ) : categories.length ? (
          categories.map(cat => (
            <CategoryCard 
              key={cat.id} 
              {...cat} 
              onClick={() => setSelectedCategory(cat.name)} 
            />
          ))
        ) : (
          <EmptyState onAdd={() => setIsDialogOpen(true)} />
        )}
      </section>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>
              Create a new category for the knowledge base.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Maintenance"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Input
                id="description"
                value={newCategoryDesc}
                onChange={(e) => setNewCategoryDesc(e.target.value)}
                placeholder="Brief description..."
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleAddCategory} disabled={isCreating || !newCategoryName.trim()}>
              {isCreating ? "Adding..." : "Add Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
