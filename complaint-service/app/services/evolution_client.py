"""
Evolution API client — sends WhatsApp messages via the self-hosted Evolution API gateway.

Evolution API docs: https://doc.evolution-api.com
GitHub:            https://github.com/EvolutionAPI/evolution-api

Relevant endpoint:
    POST /message/sendText/{instance}
    Headers: apikey: <EVOLUTION_API_KEY>
    Body:    {"number": "<jid>", "text": "<message>"}
"""
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

EVOLUTION_API_URL  = os.getenv("EVOLUTION_API_URL", "http://evolution:8080")
EVOLUTION_API_KEY  = os.getenv("EVOLUTION_API_KEY", "")
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE", "complaint-bot")
EVOLUTION_TIMEOUT  = float(os.getenv("EVOLUTION_TIMEOUT", "10"))


class EvolutionClient:
    """Async HTTP client for the self-hosted Evolution API WhatsApp gateway."""

    def __init__(self):
        self._base     = EVOLUTION_API_URL.rstrip("/")
        self._instance = EVOLUTION_INSTANCE
        self._headers  = {
            "Content-Type": "application/json",
            "apikey": EVOLUTION_API_KEY,
        }

    async def send_message(self, jid: str, text: str) -> bool:
        """
        Send a text message to a WhatsApp JID (group or contact).

        jid examples:
            Group:   120363000000000001@g.us
            Contact: 923001234567@s.whatsapp.net

        Returns True on success, False on any error.
        Errors are logged but never raised — a failed send must never
        break the complaint processing pipeline.
        """
        if not EVOLUTION_API_KEY:
            logger.warning(
                "EVOLUTION_API_KEY not set — skipping send_message to %s", jid
            )
            logger.debug("Would have sent:\n%s", text)
            return False

        url     = f"{self._base}/message/sendText/{self._instance}"
        payload = {"number": jid, "text": text}

        try:
            async with httpx.AsyncClient(timeout=EVOLUTION_TIMEOUT) as client:
                resp = await client.post(url, json=payload, headers=self._headers)
                resp.raise_for_status()
                logger.info("Evolution: message sent to %s", jid)
                return True
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Evolution send failed — HTTP %s: %s",
                exc.response.status_code, exc.response.text,
            )
        except httpx.RequestError as exc:
            logger.error("Evolution network error: %s", exc)
        except Exception as exc:
            logger.error("Evolution unexpected error: %s", exc)

        return False

    async def get_qr_code(self) -> Optional[str]:
        """
        Fetch the QR code for the configured instance.
        Returns the base64 QR image string, or None if already connected.
        Useful for health checks or a /setup endpoint.
        """
        url = f"{self._base}/instance/connect/{self._instance}"
        try:
            async with httpx.AsyncClient(timeout=EVOLUTION_TIMEOUT) as client:
                resp = await client.get(url, headers=self._headers)
                resp.raise_for_status()
                data = resp.json()
                return data.get("base64") or data.get("qrcode") or data.get("code")
        except Exception as exc:
            logger.error("Evolution QR fetch error: %s", exc)
            return None

    async def instance_status(self) -> dict:
        """Return the connection state of the configured instance."""
        url = f"{self._base}/instance/connectionState/{self._instance}"
        try:
            async with httpx.AsyncClient(timeout=EVOLUTION_TIMEOUT) as client:
                resp = await client.get(url, headers=self._headers)
                resp.raise_for_status()
                return resp.json()
        except Exception as exc:
            logger.error("Evolution status check error: %s", exc)
            return {"error": str(exc)}


# Singleton — reuse across requests
_client: Optional[EvolutionClient] = None


def get_evolution_client() -> EvolutionClient:
    global _client
    if _client is None:
        _client = EvolutionClient()
    return _client
