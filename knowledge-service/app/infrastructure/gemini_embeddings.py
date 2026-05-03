import httpx
import os
from typing import List
from societyops_dependencies.interfaces.ai import EmbeddingProvider

class GeminiEmbeddingProvider(EmbeddingProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        # Configurable via shared embedding environment variables
        self.base_url = os.getenv("EMBEDDING_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
        self.model = os.getenv("EMBEDDING_MODEL", "models/text-embedding-004")

    async def get_embedding(self, text: str) -> List[float]:
        async with httpx.AsyncClient() as client:
            # Construct the endpoint: {base_url}/{model}:embedContent
            endpoint = f"{self.base_url}/{self.model}:embedContent"
            
            response = await client.post(
                f"{endpoint}?key={self.api_key}",
                json={
                    "model": self.model,
                    "content": {"parts": [{"text": text}]}
                }
            )
            response.raise_for_status()
            return response.json()["embedding"]["values"]
