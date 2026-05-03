from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import Ticket, TicketStatus, SupervisorAction, SupervisorActionType

class TicketRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_active_tickets(self, category: Optional[str] = None, limit: int = 20) -> List[Ticket]:
        """Fetch open or in-progress tickets, optionally filtered by category."""
        stmt = select(Ticket).where(
            Ticket.status.in_([TicketStatus.open, TicketStatus.in_progress])
        )
        if category and category != "Other":
            stmt = stmt.where(Ticket.category == category)
        
        stmt = stmt.order_by(Ticket.created_at.desc()).limit(limit)
        return self.db.execute(stmt).scalars().all()

    def get_by_id(self, ticket_id: int) -> Optional[Ticket]:
        return self.db.get(Ticket, ticket_id)

    def update_status(self, ticket_id: int, status: TicketStatus) -> Optional[Ticket]:
        ticket = self.get_by_id(ticket_id)
        if ticket:
            ticket.status = status
            return ticket
        return None

    def add_supervisor_action(self, ticket_id: int, action_type: SupervisorActionType) -> SupervisorAction:
        action = SupervisorAction(ticket_id=ticket_id, action=action_type)
        self.db.add(action)
        return action

    def create_ticket(self, **kwargs) -> Ticket:
        ticket = Ticket(**kwargs)
        self.db.add(ticket)
        return ticket
