"""
Ticket management endpoints — CRUD + status updates.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Ticket, TicketStatus, TicketPriority
from app.schemas import TicketCreate, TicketUpdate, TicketResponse

router = APIRouter(prefix="/tickets", tags=["Tickets"])


@router.get("", response_model=List[TicketResponse], summary="List all tickets")
def list_tickets(
    status: Optional[TicketStatus] = Query(None, description="Filter by status"),
    priority: Optional[TicketPriority] = Query(None, description="Filter by priority"),
    category: Optional[str] = Query(None, description="Filter by category"),
    group_name: Optional[str] = Query(None, description="Filter by WhatsApp group"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(Ticket)
    if status:
        q = q.filter(Ticket.status == status)
    if priority:
        q = q.filter(Ticket.priority == priority)
    if category:
        q = q.filter(Ticket.category == category)
    if group_name:
        q = q.filter(Ticket.group_name == group_name)
    return q.order_by(Ticket.created_at.desc()).offset(skip).limit(limit).all()


@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED, summary="Create a ticket manually")
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)):
    ticket = Ticket(**payload.model_dump())
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/{ticket_id}", response_model=TicketResponse, summary="Get a ticket by ID")
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.patch("/{ticket_id}", response_model=TicketResponse, summary="Update ticket fields")
def update_ticket(ticket_id: int, payload: TicketUpdate, db: Session = Depends(get_db)):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ticket, field, value)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a ticket")
def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    db.delete(ticket)
    db.commit()
@router.delete("", status_code=status.HTTP_204_NO_CONTENT, summary="Clear all test tickets")
def clear_all_test_tickets(db: Session = Depends(get_db)):
    from app.models import Ticket, MessageLog, SupervisorAction
    # Only delete records marked as test data
    db.query(SupervisorAction).filter(SupervisorAction.is_test == True).delete(synchronize_session=False)
    db.query(MessageLog).filter(MessageLog.is_test == True).delete(synchronize_session=False)
    db.query(Ticket).filter(Ticket.is_test == True).delete(synchronize_session=False)
    db.commit()


@router.post("/seed", status_code=status.HTTP_201_CREATED, summary="Seed test tickets")
def seed_tickets(payload: List[TicketCreate], db: Session = Depends(get_db)):
    """Bulk import tickets marked as test data."""
    new_tickets = []
    for p in payload:
        ticket = Ticket(**p.model_dump(), is_test=True)
        new_tickets.append(ticket)
    
    db.add_all(new_tickets)
    db.commit()
    return {"success": True, "count": len(new_tickets)}
