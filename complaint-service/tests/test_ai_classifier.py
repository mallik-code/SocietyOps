import pytest
from app.services.ai_classifier import _keyword_classify, IntentType

def test_keyword_classify_complaint():
    text = "The lift is not working on 3rd floor"
    result = _keyword_classify(text)
    assert result.is_complaint is True
    assert result.intent == IntentType.NEW_COMPLAINT
    assert result.category == "Lift"

def test_keyword_classify_resolution():
    text = "Water brown colour issue resolved"
    result = _keyword_classify(text)
    assert result.intent == IntentType.ISSUE_RESOLUTION
    assert "water" in result.issue_summary.lower()
    assert result.is_complaint is False

def test_keyword_classify_other():
    text = "Good morning everyone"
    result = _keyword_classify(text)
    assert result.intent == IntentType.OTHER
    assert result.is_complaint is False

def test_keyword_classify_resolution_variations():
    variations = [
        "The leakage is fixed",
        "Garbage cleared done",
        "power issue sorted",
        "working now thanks"
    ]
    for text in variations:
        result = _keyword_classify(text)
        assert result.intent == IntentType.ISSUE_RESOLUTION, f"Failed for: {text}"
