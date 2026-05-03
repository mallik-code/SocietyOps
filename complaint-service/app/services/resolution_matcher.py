"""
AI-powered resolution matcher.

Matches a natural language resolution message (e.g. "Water issue fixed")
to an existing open ticket in the database using LLM.
"""
import json
import logging
import os
import re
from typing import Optional, List

from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session
from app.models import Ticket

from app.repositories.ticket_repository import TicketRepository
from app.services.ai_classifier import GROQ_API_KEY, GROQ_MODEL

logger = logging.getLogger(__name__)

_MATCHER_PROMPT_TEMPLATE = """\
A user has sent a message saying that a problem in their housing society is resolved.

Resolution Message: "{message}"
Issue Summary: "{summary}"

Below is a list of active tickets (Open or In Progress). 
Identify which ticket ID matches this resolution message.

Active Tickets:
{tickets_list}

Instructions:
1. Compare the resolution message/summary with the ticket descriptions and categories.
2. If there is a clear match, return the Ticket ID.
3. If multiple tickets match, pick the most recent one.
4. If NO tickets match, return null.
5. Return JSON only: {{"match_id": 123}} or {{"match_id": null}}

Return JSON only."""


async def find_matching_ticket(
    repo: TicketRepository,
    message: str,
    summary: str,
    category: Optional[str] = None
) -> Optional[int]:
    """
    Search for an active ticket that matches the resolution message.
    """
    # 1. Fetch active tickets via Repository
    tickets = repo.get_active_tickets(category=category, limit=20)
    
    if not tickets:
        logger.info("No active tickets found to match resolution.")
        return None

    # 2. Format tickets for LLM
    tickets_data = []
    for t in tickets:
        tickets_data.append(f"ID: {t.id} | Category: {t.category} | Description: {t.message_text[:100]}...")
    
    tickets_list_str = "\n".join(tickets_data)

    # 3. Call LLM to match
    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set, skipping AI resolution matching.")
        return _keyword_match(message, tickets)

    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=GROQ_API_KEY)
        
        prompt = _MATCHER_PROMPT_TEMPLATE.format(
            message=message,
            summary=summary,
            tickets_list=tickets_list_str
        )
        
        response = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=128,
        )
        
        raw = response.choices[0].message.content or ""
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            data = json.loads(match.group())
            match_id = data.get("match_id")
            if isinstance(match_id, int):
                return match_id
        
        return None

    except Exception as exc:
        logger.error("AI matching failed: %s", exc)
        return _keyword_match(message, tickets)


def _keyword_match(message: str, tickets: List[Ticket]) -> Optional[int]:
    """Simple keyword-based fallback if AI is unavailable."""
    msg_lower = message.lower()
    for t in tickets:
        # If category matches and any word from ticket text is in resolution message
        if t.category and t.category.lower() in msg_lower:
            return t.id
        # Or if ticket text has significant overlap with resolution message
        # (Very basic implementation)
        if any(word in msg_lower for word in t.message_text.lower().split() if len(word) > 4):
            return t.id
    return None
