"""
Supervisor action endpoints — log and retrieve actions taken on tickets.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Ticket, SupervisorAction, TicketStatus, SupervisorActionType
from app.schemas import SupervisorActionCreate, SupervisorActionResponse
from app.services.supervisor_parser import process_supervisor_reply, is_supervisor_command

router = APIRouter(prefix="/supervisor", tags=["Supervisor"])


# ─── Reply endpoint schemas ────────────────────────────────────────────────────

class SupervisorReplyRequest(BaseModel):
    message: str = Field(
        ...,
        description="Free-text supervisor command, e.g. '123 resolved' or '45 started'",
        examples=["123 resolved", "45 started", "67 delayed"],
    )


class SupervisorReplyResponse(BaseModel):
    success: bool
    ticket_id: int | None
    action: str | None
    new_status: str | None
    confirmation: str


@router.post(
    "/reply",
    response_model=SupervisorReplyResponse,
    status_code=status.HTTP_200_OK,
    summary="Process a free-text supervisor command (e.g. '123 resolved')",
)
def supervisor_reply(payload: SupervisorReplyRequest, db: Session = Depends(get_db)):
    """
    Accepts a plain-text supervisor message and:

    1. Parses the ticket ID and action from the text.
    2. Updates the ticket status in the database.
    3. Logs the action in `supervisor_actions`.
    4. Returns a ready-to-send WhatsApp confirmation string.

    Supported formats:
    - `123 resolved`  →  RESOLVED
    - `123 started`   →  IN_PROGRESS
    - `123 delayed`   →  IN_PROGRESS (flagged as delayed)
    - `#123 done`, `ticket 123 fixed`, `id 123 closed` also work.
    """
    result = process_supervisor_reply(payload.message, db)
    return SupervisorReplyResponse(
        success=result.success,
        ticket_id=result.ticket_id,
        action=result.action.value if result.action else None,
        new_status=result.new_status.value if result.new_status else None,
        confirmation=result.confirmation,
    )


@router.post(
    "/actions",
    response_model=SupervisorActionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a supervisor action on a ticket",
)
def create_action(payload: SupervisorActionCreate, db: Session = Depends(get_db)):
    ticket = db.get(Ticket, payload.ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    action = SupervisorAction(ticket_id=payload.ticket_id, action=payload.action)
    db.add(action)

    if payload.action == SupervisorActionType.STARTED:
        ticket.status = TicketStatus.IN_PROGRESS
    elif payload.action == SupervisorActionType.RESOLVED:
        ticket.status = TicketStatus.RESOLVED

    db.commit()
    db.refresh(action)
    return action


@router.get(
    "/actions",
    response_model=List[SupervisorActionResponse],
    summary="List all supervisor actions",
)
def list_actions(db: Session = Depends(get_db)):
    return db.query(SupervisorAction).order_by(SupervisorAction.timestamp.desc()).all()


@router.get(
    "/actions/ticket/{ticket_id}",
    response_model=List[SupervisorActionResponse],
    summary="List actions for a specific ticket",
)
def list_actions_for_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return (
        db.query(SupervisorAction)
        .filter(SupervisorAction.ticket_id == ticket_id)
        .order_by(SupervisorAction.timestamp.asc())
        .all()
    )
