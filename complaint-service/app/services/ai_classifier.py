"""
AI-powered complaint classifier.

Uses OpenAI GPT when OPENAI_API_KEY is set; falls back to a lightweight
keyword-based classifier so the service runs without any API key.
"""
import os
import re
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")

# ─── Category definitions ──────────────────────────────────────────────────────

CATEGORIES = [
    "Water Supply",
    "Electricity",
    "Road & Infrastructure",
    "Garbage & Sanitation",
    "Noise Pollution",
    "Public Safety",
    "Healthcare",
    "Education",
    "Housing",
    "Transportation",
    "Environment",
    "Other",
]

PRIORITY_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

# ─── Keyword-based fallback ────────────────────────────────────────────────────

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Water Supply": ["water", "pipe", "leak", "flood", "drainage", "sewage", "tap"],
    "Electricity": ["electricity", "power", "outage", "blackout", "wiring", "electric", "voltage"],
    "Road & Infrastructure": ["road", "pothole", "bridge", "footpath", "pavement", "crack", "construction"],
    "Garbage & Sanitation": ["garbage", "trash", "waste", "litter", "dump", "rubbish", "sanitation"],
    "Noise Pollution": ["noise", "loud", "music", "sound", "disturbance", "horn"],
    "Public Safety": ["crime", "theft", "robbery", "assault", "danger", "police", "safety", "attack"],
    "Healthcare": ["hospital", "clinic", "medicine", "doctor", "health", "ambulance", "disease"],
    "Education": ["school", "college", "teacher", "student", "university", "class", "exam"],
    "Housing": ["house", "building", "roof", "wall", "rent", "landlord", "accommodation"],
    "Transportation": ["bus", "train", "taxi", "transport", "vehicle", "traffic", "commute"],
    "Environment": ["pollution", "smoke", "tree", "forest", "air", "chemical", "toxic"],
}

_PRIORITY_KEYWORDS: dict[str, list[str]] = {
    "CRITICAL": ["urgent", "emergency", "immediately", "critical", "dangerous", "life", "death", "fire", "injury"],
    "HIGH": ["serious", "severe", "major", "important", "bad", "broken", "flooding"],
    "LOW": ["minor", "small", "little", "slight", "occasionally"],
}


def _keyword_classify(text: str) -> Tuple[str, str]:
    lower = text.lower()

    category = "Other"
    best_score = 0
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in lower)
        if score > best_score:
            best_score = score
            category = cat

    priority = "MEDIUM"
    for level in ("CRITICAL", "HIGH", "LOW"):
        if any(kw in lower for kw in _PRIORITY_KEYWORDS.get(level, [])):
            priority = level
            break

    return category, priority


# ─── OpenAI classifier ─────────────────────────────────────────────────────────

_SYSTEM_PROMPT = f"""You are a complaint classification assistant for a local government complaint management system.

Given a complaint message, respond with ONLY a JSON object in this exact format:
{{"category": "<category>", "priority": "<priority>"}}

Categories (pick exactly one): {", ".join(CATEGORIES)}
Priority levels (pick exactly one): CRITICAL, HIGH, MEDIUM, LOW

Priority guide:
- CRITICAL: imminent threat to life/safety, emergency situation
- HIGH: serious issue affecting many people or critical infrastructure  
- MEDIUM: significant issue needing attention within days
- LOW: minor inconvenience or cosmetic issue

Respond with ONLY the JSON, no explanation."""


async def _openai_classify(text: str) -> Tuple[str, str]:
    try:
        import openai  # lazy import — only needed when key is set

        client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
        response = await client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": text[:2000]},
            ],
            temperature=0,
            max_tokens=60,
        )
        raw = response.choices[0].message.content or ""
        match = re.search(r'\{.*?\}', raw, re.DOTALL)
        if not match:
            raise ValueError("No JSON found in response")
        import json
        data = json.loads(match.group())
        category = data.get("category", "Other")
        priority = data.get("priority", "MEDIUM").upper()
        if category not in CATEGORIES:
            category = "Other"
        if priority not in PRIORITY_LEVELS:
            priority = "MEDIUM"
        return category, priority
    except Exception as exc:
        logger.warning("OpenAI classification failed (%s); falling back to keyword classifier.", exc)
        return _keyword_classify(text)


# ─── Public interface ──────────────────────────────────────────────────────────

async def classify_complaint(text: str) -> Tuple[str, str]:
    """
    Returns (category, priority) for the given complaint text.
    Uses OpenAI when OPENAI_API_KEY is set, otherwise uses keyword matching.
    """
    if OPENAI_API_KEY:
        return await _openai_classify(text)
    return _keyword_classify(text)
