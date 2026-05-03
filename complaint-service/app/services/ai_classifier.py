"""
AI-powered complaint classifier using the GROQ API.

Returns a structured JSON result:
{
    "is_complaint": true/false,
    "intent": "NEW_COMPLAINT|ISSUE_RESOLUTION|OTHER",
    "category": "Lift|Garbage|Cleaning|Water|Electrical|Security|Other",
    "priority": "High|Medium|Low",
    "location": "string or null",
    "issue_summary": "short summary if it is a resolution",
    "confidence": 0.0 – 1.0
}

Falls back to a keyword-based classifier when GROQ_API_KEY is not set.
"""
import json
import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama3-8b-8192")

CATEGORIES = ["Lift", "Garbage", "Cleaning", "Water", "Electrical", "Security", "Other"]
PRIORITIES = ["High", "Medium", "Low"]


# ─── Result dataclass ──────────────────────────────────────────────────────────

class ClassificationResult:
    __slots__ = ("is_complaint", "intent", "category", "priority", "location", "issue_summary", "confidence")

    def __init__(
        self,
        is_complaint: bool,
        category: str,
        priority: str,
        location: Optional[str],
        confidence: float,
        intent: str = "NEW_COMPLAINT",
        issue_summary: Optional[str] = None,
    ):
        self.is_complaint = is_complaint
        self.intent = intent
        self.category = category
        self.priority = priority
        self.location = location
        self.issue_summary = issue_summary
        self.confidence = round(max(0.0, min(1.0, confidence)), 2)

    def to_dict(self) -> dict:
        return {
            "is_complaint": self.is_complaint,
            "intent": self.intent,
            "category": self.category,
            "priority": self.priority,
            "location": self.location,
            "issue_summary": self.issue_summary,
            "confidence": self.confidence,
        }


# ─── Intent Types ─────────────────────────────────────────────────────────────

class IntentType:
    NEW_COMPLAINT = "NEW_COMPLAINT"
    ISSUE_RESOLUTION = "ISSUE_RESOLUTION"
    OTHER = "OTHER"


# ─── Prompt template ──────────────────────────────────────────────────────────

_USER_PROMPT_TEMPLATE = """\
Classify the following WhatsApp message from a housing society member.

Return JSON with:
- intent: "NEW_COMPLAINT" (if reporting a problem), "ISSUE_RESOLUTION" (if saying something is fixed/resolved), or "OTHER" (greetings, etc.)
- is_complaint: true if it's reporting a problem (NEW_COMPLAINT)
- category: (Lift, Garbage, Cleaning, Water, Electrical, Security, Other)
- priority: (High, Medium, Low)
- location: (if mentioned)
- issue_summary: (if it's a resolution, summarize what was fixed in 3-5 words, e.g. "water leakage" or "lift 3rd floor")
- confidence: (0 to 1)

Message: "{message}"

Return JSON only."""


def _build_prompt(message: str) -> str:
    return _USER_PROMPT_TEMPLATE.format(message=message)


# ─── GROQ classifier ──────────────────────────────────────────────────────────

def _parse_result(raw: str) -> ClassificationResult:
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object found in response: {raw!r}")
    data = json.loads(match.group())

    intent = data.get("intent", IntentType.NEW_COMPLAINT)
    if intent not in [IntentType.NEW_COMPLAINT, IntentType.ISSUE_RESOLUTION, IntentType.OTHER]:
        intent = IntentType.OTHER

    is_complaint = bool(data.get("is_complaint", intent == IntentType.NEW_COMPLAINT))
    category = data.get("category", "Other")
    if category not in CATEGORIES:
        category = "Other"
    priority = data.get("priority", "Medium")
    if priority not in PRIORITIES:
        priority = "Medium"
    location = data.get("location") or None
    if isinstance(location, str) and location.strip().lower() in ("null", "none", "n/a", ""):
        location = None
    
    issue_summary = data.get("issue_summary")

    try:
        confidence = float(data.get("confidence", 0.5))
    except (TypeError, ValueError):
        confidence = 0.5

    return ClassificationResult(
        is_complaint=is_complaint,
        intent=intent,
        category=category,
        priority=priority,
        location=location,
        issue_summary=issue_summary,
        confidence=confidence,
    )


async def _groq_classify(text: str) -> ClassificationResult:
    try:
        from groq import AsyncGroq  # lazy import — only when key is configured

        client = AsyncGroq(api_key=GROQ_API_KEY)
        response = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "user", "content": _build_prompt(text[:3000])},
            ],
            temperature=0,
            max_tokens=256,
        )
        raw = response.choices[0].message.content or ""
        return _parse_result(raw)

    except Exception as exc:
        logger.warning("GROQ classification failed (%s); falling back to keyword classifier.", exc)
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

    # Detect intent
    intent = IntentType.NEW_COMPLAINT
    issue_summary = None

    resolved_keywords = ["resolved", "fixed", "done", "working now", "repaired", "sorted", "issue resolved"]
    if any(kw in lower for kw in resolved_keywords):
        intent = IntentType.ISSUE_RESOLUTION
        # Simple extraction: remove 'resolved' etc.
        summary = lower
        for kw in resolved_keywords:
            summary = summary.replace(kw, "")
        issue_summary = summary.strip()[:50]

    is_complaint = (intent == IntentType.NEW_COMPLAINT)
    if is_complaint:
        for pattern in _NON_COMPLAINT_PATTERNS:
            if re.fullmatch(pattern, lower, re.IGNORECASE):
                is_complaint = False
                intent = IntentType.OTHER
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
        intent=intent,
        category=category,
        priority=priority,
        location=location,
        issue_summary=issue_summary,
        confidence=confidence,
    )


# ─── Public interface ──────────────────────────────────────────────────────────

async def classify_complaint(text: str) -> ClassificationResult:
    """
    Classify the given message text.

    Uses GROQ when GROQ_API_KEY is set; otherwise falls back to the
    keyword-based classifier which requires no external dependencies.
    """
    if GROQ_API_KEY:
        return await _groq_classify(text)
    return _keyword_classify(text)
