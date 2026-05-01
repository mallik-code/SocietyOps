"""
AI-powered complaint classifier using the Anthropic Claude API.

Returns a structured JSON result:
{
    "is_complaint": true/false,
    "category": "Lift|Garbage|Cleaning|Water|Electrical|Security|Other",
    "priority": "High|Medium|Low",
    "location": "string or null",
    "confidence": 0.0 – 1.0
}

Falls back to a keyword-based classifier when ANTHROPIC_API_KEY is not set.
"""
import json
import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-3-haiku-20240307")

CATEGORIES = ["Lift", "Garbage", "Cleaning", "Water", "Electrical", "Security", "Other"]
PRIORITIES = ["High", "Medium", "Low"]

# ─── Result dataclass ──────────────────────────────────────────────────────────

class ClassificationResult:
    __slots__ = ("is_complaint", "category", "priority", "location", "confidence")

    def __init__(
        self,
        is_complaint: bool,
        category: str,
        priority: str,
        location: Optional[str],
        confidence: float,
    ):
        self.is_complaint = is_complaint
        self.category = category
        self.priority = priority
        self.location = location
        self.confidence = round(max(0.0, min(1.0, confidence)), 2)

    def to_dict(self) -> dict:
        return {
            "is_complaint": self.is_complaint,
            "category": self.category,
            "priority": self.priority,
            "location": self.location,
            "confidence": self.confidence,
        }


# ─── Prompt ───────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = f"""You are a complaint classification assistant for a residential building management system.

Analyse the input message and respond with ONLY a valid JSON object — no markdown, no explanation, no extra text.

JSON schema (strictly follow this):
{{
  "is_complaint": <boolean — true if the message is a genuine complaint, false for greetings/casual/spam>,
  "category": "<one of: {", ".join(CATEGORIES)}>",
  "priority": "<one of: High, Medium, Low>",
  "location": "<extracted location string or null if not mentioned>",
  "confidence": <float between 0 and 1 indicating classification confidence>
}}

Rules:
- Set is_complaint=false for greetings, thank-you messages, casual chat, announcements, and non-actionable messages.
- When is_complaint=false, still fill in the other fields with your best guess; set confidence low (≤0.3).
- Urgency keywords that raise priority to High: "urgent", "emergency", "not working", "immediately", "danger", "stuck", "flooding", "fire", "broken".
- Priority Medium: issue is real but not immediately dangerous.
- Priority Low: cosmetic, minor inconvenience, or can wait.
- Location: extract any floor number, flat number, block, area, or specific place mentioned in the text.
- Respond ONLY with the JSON object. No extra text."""


# ─── Claude classifier ────────────────────────────────────────────────────────

def _parse_result(raw: str) -> ClassificationResult:
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object found in response: {raw!r}")
    data = json.loads(match.group())

    is_complaint = bool(data.get("is_complaint", True))
    category = data.get("category", "Other")
    if category not in CATEGORIES:
        category = "Other"
    priority = data.get("priority", "Medium")
    if priority not in PRIORITIES:
        priority = "Medium"
    location = data.get("location") or None
    if isinstance(location, str) and location.strip().lower() in ("null", "none", "n/a", ""):
        location = None
    try:
        confidence = float(data.get("confidence", 0.5))
    except (TypeError, ValueError):
        confidence = 0.5

    return ClassificationResult(
        is_complaint=is_complaint,
        category=category,
        priority=priority,
        location=location,
        confidence=confidence,
    )


async def _claude_classify(text: str) -> ClassificationResult:
    try:
        import anthropic  # lazy import — only when key is configured

        client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        message = await client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=256,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": text[:3000]}],
        )
        raw = message.content[0].text
        return _parse_result(raw)

    except Exception as exc:
        logger.warning("Claude classification failed (%s); falling back to keyword classifier.", exc)
        return _keyword_classify(text)


# ─── Keyword-based fallback ────────────────────────────────────────────────────

_URGENCY_KEYWORDS = [
    "urgent", "emergency", "immediately", "not working", "broken",
    "stuck", "danger", "flooding", "fire", "help", "asap",
]

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Lift": ["lift", "elevator", "stuck in lift", "elevator not working"],
    "Garbage": ["garbage", "trash", "waste", "rubbish", "dustbin", "litter", "dump"],
    "Cleaning": ["dirty", "cleaning", "swept", "mop", "stain", "unclean", "hygiene"],
    "Water": ["water", "pipe", "leak", "tap", "plumb", "drainage", "flood", "sewage"],
    "Electrical": ["electricity", "electric", "power", "light", "wiring", "outage", "blackout", "voltage", "socket"],
    "Security": ["security", "cctv", "camera", "guard", "theft", "robbery", "crime", "stranger", "break"],
}

_NON_COMPLAINT_PATTERNS = [
    r"^\s*(hi|hello|hey|good\s+(morning|afternoon|evening|night)|thanks|thank you|ok|okay|noted|sure|great)\s*[!.]*\s*$",
]

_LOCATION_PATTERNS = [
    r"(?:flat|floor|block|unit|room|wing|level|apt|apartment)\s*[\w\d\-/]+",
    r"\b(?:basement|ground floor|terrace|rooftop|parking|lobby|corridor|staircase)\b",
    r"\b\d+(?:st|nd|rd|th)\s+floor\b",
]


def _keyword_classify(text: str) -> ClassificationResult:
    lower = text.lower().strip()

    is_complaint = True
    for pattern in _NON_COMPLAINT_PATTERNS:
        if re.fullmatch(pattern, lower, re.IGNORECASE):
            is_complaint = False
            break

    category = "Other"
    best_score = 0
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in lower)
        if score > best_score:
            best_score = score
            category = cat

    priority = "Medium"
    if any(kw in lower for kw in _URGENCY_KEYWORDS):
        priority = "High"
    elif best_score == 0 and is_complaint:
        priority = "Low"

    location: Optional[str] = None
    for pat in _LOCATION_PATTERNS:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            location = m.group().strip()
            break

    confidence = min(0.4 + best_score * 0.1, 0.75) if is_complaint else 0.2

    return ClassificationResult(
        is_complaint=is_complaint,
        category=category,
        priority=priority,
        location=location,
        confidence=confidence,
    )


# ─── Public interface ──────────────────────────────────────────────────────────

async def classify_complaint(text: str) -> ClassificationResult:
    """
    Classify the given message text.

    Uses Claude when ANTHROPIC_API_KEY is set; otherwise falls back to the
    keyword-based classifier which requires no external dependencies.
    """
    if ANTHROPIC_API_KEY:
        return await _claude_classify(text)
    return _keyword_classify(text)
