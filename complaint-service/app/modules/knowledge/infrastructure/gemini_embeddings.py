import httpx
from typing import List
from app.modules.knowledge.core.interfaces import EmbeddingProvider

class GeminiEmbeddingProvider(EmbeddingProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.url = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"

    async def get_embedding(self, text: str) -> List[float]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.url}?key={self.api_key}",
                json={
                    "model": "models/text-embedding-004",
                    "content": {"parts": [{"text": text}]}
                }
            )
            response.raise_for_status()
            return response.json()["embedding"]["values"]
