import httpx
import os
import logging
from typing import List
from societyops_dependencies.interfaces.ai import EmbeddingProvider

logger = logging.getLogger(__name__)

class GeminiEmbeddingProvider(EmbeddingProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        # Configurable via shared embedding environment variables
        self.base_url = os.getenv("EMBEDDING_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
        self.model = os.getenv("EMBEDDING_MODEL", "models/text-embedding-004")

    async def get_embedding(self, text: str) -> List[float]:
        try:
            async with httpx.AsyncClient() as client:
                # Construct the endpoint: {base_url}/{model}:embedContent
                endpoint = f"{self.base_url}/{self.model}:embedContent"
                
                response = await client.post(
                    f"{endpoint}?key={self.api_key}",
                    json={
                        "model": self.model,
                        "content": {"parts": [{"text": text}]}
                    },
                    timeout=10.0
                )
                
                if response.status_code != 200:
                    logger.error(f"Embedding API error {response.status_code}: {response.text}")
                    return [0.0] * 768
                
                data = response.json()
                if "embedding" not in data:
                    logger.error(f"Invalid embedding response: {data}")
                    return [0.0] * 768
                    
                return data["embedding"]["values"]
        except Exception as e:
            logger.error(f"Embedding API exception: {str(e)}")
            return [0.0] * 768
