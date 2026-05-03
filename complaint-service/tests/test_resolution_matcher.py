import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from app.services.resolution_matcher import find_matching_ticket, _keyword_match
from app.models import Ticket, TicketStatus

@pytest.fixture
def mock_repo():
    return MagicMock()

@pytest.fixture
def mock_tickets():
    t1 = Ticket(id=1, message_text="Lift is stuck on floor 4", category="Lift", status=TicketStatus.open)
    t2 = Ticket(id=2, message_text="Water leakage in basement", category="Water", status=TicketStatus.open)
    return [t1, t2]

def test_keyword_match_by_category(mock_tickets):
    # Match by category 'Water'
    match_id = _keyword_match("Water issue resolved", mock_tickets)
    assert match_id == 2

def test_keyword_match_by_content(mock_tickets):
    # Match by word 'stuck' or 'leakage'
    match_id = _keyword_match("The leakage is fixed", mock_tickets)
    assert match_id == 2
    
    match_id = _keyword_match("Lift stuck fixed", mock_tickets)
    assert match_id == 1

@pytest.mark.asyncio
async def test_find_matching_ticket_ai_success(mock_repo, mock_tickets):
    # Mock Repo method
    mock_repo.get_active_tickets.return_value = mock_tickets
    
    # Mock GROQ call
    with patch("groq.AsyncGroq", create=True) as mock_groq:
        mock_client = mock_groq.return_value
        mock_client.chat.completions.create = AsyncMock(return_value=MagicMock(
            choices=[MagicMock(message=MagicMock(content='{"match_id": 1}'))]
        ))
        
        with patch("app.services.resolution_matcher.GROQ_API_KEY", "fake_key"):
            match_id = await find_matching_ticket(mock_repo, "Lift issue resolved", "lift issue", "Lift")
            assert match_id == 1

@pytest.mark.asyncio
async def test_find_matching_ticket_no_active_tickets(mock_repo):
    mock_repo.get_active_tickets.return_value = []
    match_id = await find_matching_ticket(mock_repo, "any message", "summary")
    assert match_id is None
