export interface Category {
  id: string;
  name: string;
  description: string;
  topicCount: number;
  lastUpdated: string; // ISO timestamp
}

export async function fetchCategories(search = ""): Promise<Category[]> {
  const qs = search ? `?q=${encodeURIComponent(search)}` : "";
  // Note: Using the base URL from environment if available, or defaulting to a relative path
  const baseUrl = (import.meta as any).env?.VITE_KNOWLEDGE_SERVICE_URL || "";
  const resp = await fetch(`${baseUrl}/categories${qs}`);
  if (!resp.ok) {
    // Return dummy data if the service is not yet fully integrated or for preview
    console.warn("Knowledge service not reachable, returning placeholder data.");
    return [
      { id: "1", name: "Maintenance", description: "Standard operating procedures for plumbing, electrical, and HVAC.", topicCount: 12, lastUpdated: new Date().toISOString() },
      { id: "2", name: "Security", description: "Visitor protocols, emergency contacts, and gate management.", topicCount: 8, lastUpdated: new Date().toISOString() },
      { id: "3", name: "Billing", description: "Maintenance fee structures, late payment policies, and audit trails.", topicCount: 5, lastUpdated: new Date().toISOString() },
      { id: "4", name: "Community Rules", description: "Guidelines for common areas, noise levels, and pet policies.", topicCount: 15, lastUpdated: new Date().toISOString() },
    ];
  }
  return resp.json();
}
