"""
OpenClaw API client — sends WhatsApp messages back to a group via OpenClaw's REST API.

Docs reference: https://docs.openclaw.io  (adjust base URL / payload shape to match
your OpenClaw instance version if it differs from the defaults below).
"""
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

OPENCLAW_API_URL = os.getenv("OPENCLAW_API_URL", "https://api.openclaw.io")
OPENCLAW_API_KEY = os.getenv("OPENCLAW_API_KEY", "")
OPENCLAW_TIMEOUT = float(os.getenv("OPENCLAW_TIMEOUT", "10"))


class OpenClawClient:
    """Async HTTP client for the OpenClaw WhatsApp gateway."""

    def __init__(self):
        self._base = OPENCLAW_API_URL.rstrip("/")
        self._headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENCLAW_API_KEY}",
        }

    async def send_message(self, group_id: str, text: str) -> bool:
        """
        Send a text message to a WhatsApp group via OpenClaw.

        Returns True on success, False on any error (errors are logged, never raised
        so a send failure never breaks the complaint pipeline).
        """
        if not OPENCLAW_API_KEY:
            logger.warning(
                "OPENCLAW_API_KEY is not set — skipping send_message to group %s", group_id
            )
            logger.debug("Message that would have been sent:\n%s", text)
            return False

        url = f"{self._base}/v1/messages"
        payload = {"to": group_id, "type": "text", "text": text}

        try:
            async with httpx.AsyncClient(timeout=OPENCLAW_TIMEOUT) as client:
                response = await client.post(url, json=payload, headers=self._headers)
                response.raise_for_status()
                logger.info("OpenClaw: message sent to group %s", group_id)
                return True
        except httpx.HTTPStatusError as exc:
            logger.error(
                "OpenClaw send failed — HTTP %s: %s",
                exc.response.status_code,
                exc.response.text,
            )
        except httpx.RequestError as exc:
            logger.error("OpenClaw network error: %s", exc)
        except Exception as exc:
            logger.error("OpenClaw unexpected error: %s", exc)

        return False


# Singleton — reuse across requests
_client: Optional[OpenClawClient] = None


def get_openclaw_client() -> OpenClawClient:
    global _client
    if _client is None:
        _client = OpenClawClient()
    return _client
