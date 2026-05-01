"""
Supervisor action endpoints — log and retrieve actions taken on tickets.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Ticket, SupervisorAction, TicketStatus, SupervisorActionType
from app.schemas import SupervisorActionCreate, SupervisorActionResponse

router = APIRouter(prefix="/supervisor", tags=["Supervisor"])


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
