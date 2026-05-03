import httpx
import os
from typing import List
from societyops_dependencies.interfaces.ai import EmbeddingProvider

class OpenAICompatibleEmbeddingProvider(EmbeddingProvider):
    """
    Works with OpenAI, LocalAI, and other providers that follow 
    the OpenAI Embedding API format.
    """
    def __init__(self, api_key: str):
        self.api_key = api_key
        # Configurable via shared embedding environment variables
        self.base_url = os.getenv("EMBEDDING_BASE_URL", "https://api.openai.com/v1")
        self.model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

    async def get_embedding(self, text: str) -> List[float]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/embeddings",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "input": text
                }
            )
            response.raise_for_status()
            # OpenAI format: data[0].embedding
            return response.json()["data"][0]["embedding"]
