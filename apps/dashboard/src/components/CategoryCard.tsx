import { Book, Clock, Lightbulb } from "lucide-react";
import type { Category } from "@/api/knowledge";

interface Props extends Category {
  onClick: () => void;
}

export default function CategoryCard({ name, description, topicCount, lastUpdated, onClick }: Props) {
  return (
    <article 
      className="kb-card" 
      onClick={onClick} 
      role="button" 
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="kb-icon-wrapper">
        <Book className="w-5 h-5" />
      </div>
      <h2 className="kb-title">{name}</h2>
      <p className="kb-desc">{description}</p>
      <div className="kb-meta">
        <div className="kb-meta-item">
          <Lightbulb className="w-3.5 h-3.5" />
          <span>{topicCount} topics</span>
        </div>
        <div className="kb-meta-item">
          <Clock className="w-3.5 h-3.5" />
          <span>{new Date(lastUpdated).toLocaleDateString()}</span>
        </div>
      </div>
    </article>
  );
}
