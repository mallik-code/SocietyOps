import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { fetchCategories, type Category } from "@/api/knowledge";
import CategoryCard from "@/components/CategoryCard";
import EmptyState from "@/components/EmptyState";
import "@/styles/knowledge-bank.css";

export default function KnowledgeBankPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      fetchCategories(query).then(data => {
        setCategories(data);
        setIsLoading(false);
      }).catch(err => {
        console.error(err);
        setIsLoading(false);
      });
    }, 300); // debounce
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <main className="kb-page">
      <header className="kb-header">
        <h1>Knowledge Bank</h1>
        <div className="kb-search-container">
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
              onClick={() => console.log(`Navigate to category ${cat.id}`)} 
            />
          ))
        ) : (
          <EmptyState onAdd={() => console.log("Add new category")} />
        )}
      </section>
    </main>
  );
}
