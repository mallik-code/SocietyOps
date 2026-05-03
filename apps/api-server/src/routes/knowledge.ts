import { Router, Request, Response } from "express";

const router = Router();
const KNOWLEDGE_SERVICE_URL = process.env.KNOWLEDGE_SERVICE_URL || "http://localhost:8000";

router.get("/categories", async (req: Request, res: Response) => {
  try {
    const q = req.query.q ? `?q=${encodeURIComponent(req.query.q as string)}` : "";
    const response = await fetch(`${KNOWLEDGE_SERVICE_URL}/categories${q}`);
    
    if (!response.ok) {
      throw new Error(`Knowledge service returned ${response.status}`);
    }

    const data = await response.json();
    
    // Map the response to match what the frontend expects
    const mappedData = data.map((cat: any) => ({
      id: cat.name, // Using name as ID since it's unique in the Python backend
      name: cat.name,
      description: "Category description not provided by backend.", // Backend currently doesn't store description
      topicCount: cat.topic_count,
      lastUpdated: cat.last_updated
    }));

    res.json(mappedData);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/categories", async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    
    // To "create" a category in the current backend, we ingest an initial knowledge item.
    // The knowledge-service just groups by category.
    const payload = {
      content: `Initial knowledge item for category: ${name}. ${description || ""}`,
      category: name,
      metadata: { description }
    };

    const response = await fetch(`${KNOWLEDGE_SERVICE_URL}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Knowledge service returned ${response.status}: ${err}`);
    }

    const data = await response.json();
    res.status(201).json({
      id: name,
      name: name,
      description: description || "",
      topicCount: 1,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.get("/search", async (req: Request, res: Response) => {
  try {
    const { query, limit } = req.query;
    const url = new URL(`${KNOWLEDGE_SERVICE_URL}/search`);
    if (query) url.searchParams.append("query", query as string);
    if (limit) url.searchParams.append("limit", limit as string);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Knowledge service returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error searching knowledge:", error);
    res.status(500).json({ error: "Failed to search knowledge" });
  }
});

export default router;
