export interface ResearchDocument {
  id: string;
  source_name: string;
  chunk_count: number;
}

export interface SearchResult {
  id: number;
  content: string;
  source_name: string;
  page_number: number;
  rrf_score: float;
}

const API_BASE = "/api/research";

export async function uploadDocument(file: File, collectionId: string): Promise<ResearchDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("collection_id", collectionId);

  const resp = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Upload failed: ${err}`);
  }

  return resp.json();
}

export async function searchInCollection(collectionId: string, query: string, limit = 5): Promise<SearchResult[]> {
  const resp = await fetch(`${API_BASE}/collections/${collectionId}/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  if (!resp.ok) {
    throw new Error("Search failed");
  }
  return resp.json();
}

export async function ingestGoogleDriveFile(fileId: string, collectionId: string): Promise<ResearchDocument> {
  const resp = await fetch(`${API_BASE}/google-drive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, collection_id: collectionId }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Google Drive ingestion failed: ${err}`);
  }

  return resp.json();
}

export async function listDocuments(collectionId: string): Promise<any[]> {
  const resp = await fetch(`${API_BASE}/collections/${collectionId}/documents`);
  if (!resp.ok) {
    throw new Error("Failed to list documents");
  }
  return resp.json();
}
