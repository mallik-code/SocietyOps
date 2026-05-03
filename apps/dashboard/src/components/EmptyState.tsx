import { SearchX, Plus } from "lucide-react";

export default function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="kb-empty">
      <div className="kb-empty-icon">
        <SearchX className="w-16 h-16" />
      </div>
      <h2>No knowledge found</h2>
      <p>Try adjusting your search or add a new category to the bank.</p>
      <button className="kb-cta flex items-center gap-2" onClick={onAdd}>
        <Plus className="w-4 h-4" />
        Add Category
      </button>
    </div>
  );
}
