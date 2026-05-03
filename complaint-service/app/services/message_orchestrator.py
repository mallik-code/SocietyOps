import logging
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session

from app.models import MessageLog, Ticket, TicketStatus, TicketPriority, SupervisorActionType
from app.repositories.ticket_repository import TicketRepository
from app.services.ai_classifier import classify_complaint, ClassificationResult, IntentType
from app.services.resolution_matcher import find_matching_ticket
from app.services.policy_engine import evaluate_inbound, evaluate_classification
from app.services.response_generator import generate_whatsapp_reply, generate_ignored_reply
from app.services.supervisor_parser import is_supervisor_command, process_supervisor_reply

logger = logging.getLogger(__name__)

class ProcessedResult:
    def __init__(
        self,
        status: str,
        reason: str,
        ticket_id: Optional[int] = None,
        matched_ticket_id: Optional[int] = None,
        whatsapp_reply: Optional[str] = None,
        classification: Optional[ClassificationResult] = None,
        violations: List[str] = None
    ):
        self.status = status
        self.reason = reason
        self.ticket_id = ticket_id
        self.matched_ticket_id = matched_ticket_id
        self.whatsapp_reply = whatsapp_reply
        self.classification = classification
        self.violations = violations or []

class MessageOrchestrator:
    def __init__(self, db: Session):
        self.db = db
        self.repo = TicketRepository(db)

    async def process_message(
        self,
        message_text: str,
        sender_jid: str,
        sender_name: Optional[str] = None,
        group_jid: Optional[str] = None,
        group_name: Optional[str] = None
    ) -> ProcessedResult:
        """
        Orchestrates the entire message processing flow.
        """
        # 1. Policy Phase 1
        inbound = evaluate_inbound(
            message_text=message_text,
            group_id=group_jid,
            group_name=group_name,
            sender_id=sender_jid,
        )
        if not inbound.allow_processing:
            return ProcessedResult(status="blocked", reason=inbound.reason, violations=inbound.violations)

        # 2. Log Message
        self.db.add(MessageLog(
            raw_message=message_text,
            sender=sender_jid,
            group_name=group_jid or sender_jid,
        ))
        self.db.flush()

        # 3. Supervisor Commands
        if is_supervisor_command(message_text):
            sv = process_supervisor_reply(message_text, self.db)
            return ProcessedResult(
                status="supervisor_action",
                reason="supervisor command processed",
                ticket_id=sv.ticket_id,
                whatsapp_reply=sv.confirmation if inbound.allow_reply else None,
                violations=inbound.violations
            )

        # 4. AI Classification
        try:
            result = await classify_complaint(message_text)
        except Exception as exc:
            logger.error("Orchestrator: classification error: %s", exc)
            result = ClassificationResult(
                is_complaint=True, category="Other",
                priority="Medium", location=None, confidence=0.0,
            )

        # 5. Intent Handling: Resolution
        if result.intent == IntentType.ISSUE_RESOLUTION:
            match_id = await find_matching_ticket(
                repo=self.repo,
                message=message_text,
                summary=result.issue_summary or message_text,
                category=result.category
            )
            if match_id:
                self.repo.update_status(match_id, TicketStatus.resolved)
                self.repo.add_supervisor_action(match_id, SupervisorActionType.resolved)
                self.db.commit()
                
                ticket = self.repo.get_by_id(match_id)
                whatsapp_reply = f"✅ Resolved — Ticket #{match_id}\n" \
                                 f"Matched to: '{ticket.message_text[:50]}...'"
                
                return ProcessedResult(
                    status="resolved_automatically",
                    reason=f"AI matched resolution to Ticket #{match_id}",
                    matched_ticket_id=match_id,
                    whatsapp_reply=whatsapp_reply if inbound.allow_reply else None,
                    classification=result,
                    violations=inbound.violations
                )

        # 6. Intent Handling: New Complaint
        post = evaluate_classification(
            is_complaint=result.is_complaint,
            confidence=result.confidence,
            group_id=group_jid,
        )
        all_violations = inbound.violations + post.violations

        ticket_id = None
        whatsapp_reply = None

        if post.allow_ticket:
            priority_map = {"high": TicketPriority.High, "medium": TicketPriority.Medium, "low": TicketPriority.Low}
            priority = priority_map.get(result.priority.lower(), TicketPriority.Medium)
            
            ticket = self.repo.create_ticket(
                message_text=message_text,
                category=result.category,
                priority=priority,
                location=result.location,
                status=TicketStatus.open,
                reporter_name=sender_name,
                group_name=group_jid or sender_jid,
            )
            self.db.commit()
            self.db.refresh(ticket)
            ticket_id = ticket.id
            whatsapp_reply = generate_whatsapp_reply(ticket)
        else:
            self.db.commit()
            if result.is_complaint:
                whatsapp_reply = generate_ignored_reply()

        return ProcessedResult(
            status="processed",
            reason=post.reason,
            ticket_id=ticket_id,
            whatsapp_reply=whatsapp_reply if post.allow_reply else None,
            classification=result,
            violations=all_violations
        )
