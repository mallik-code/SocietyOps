export interface Category {
  id: string;
  name: string;
  description: string;
  topicCount: number;
  lastUpdated: string; // ISO timestamp
}

// All calls go through the api-server which runs on /api (proxied via Vite or nginx)
const API_BASE = "/api/knowledge";

export async function fetchCategories(search = ""): Promise<Category[]> {
  const qs = search ? `?q=${encodeURIComponent(search)}` : "";
  const resp = await fetch(`${API_BASE}/categories${qs}`);
  if (!resp.ok) {
    console.error("Failed to fetch categories from knowledge service.");
    return [];
  }
  return resp.json();
}

export async function createCategory(data: { name: string; description: string }): Promise<Category> {
  const resp = await fetch(`${API_BASE}/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to create category: ${resp.status} ${text}`);
  }
  
  return resp.json();
}
export async function searchKnowledge(query: string, limit = 5): Promise<any[]> {
  const resp = await fetch(`${API_BASE}/search?query=${encodeURIComponent(query)}&limit=${limit}`);
  if (!resp.ok) {
    throw new Error("Failed to search knowledge");
  }
  return resp.json();
}
