from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...schemas.chore_and_ticket import ChoreCreate, TicketUpdate
from ...models.model import Chore, Ticket
from ...core.generate_monthly_tickets import generate_monthly_tickets
from ...core.generate_house_chores import generate_house_chores
from ..dependencies import get_current_user
from ...db.database import get_db


router = APIRouter(prefix="/chores", tags=["Chores"])


@router.post("/add")
def add_chore(
    chore: ChoreCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.house_id:
        raise HTTPException(status_code=400, detail="You must belong to a house first.")

    new_chore = Chore(
        name=chore.name,
        description=chore.description,
        difficulty_level=chore.difficulty_level,
        chore_frequency=chore.chore_frequency,
        chore_priority=chore.chore_priority,
        duration=chore.duration,
        notes=chore.notes,
        icon=chore.icon,
        house_id=current_user.house_id,
    )

    db.add(new_chore)
    db.commit()
    db.refresh(new_chore)
    return {"status": "chore added", "chore_id": new_chore.id}


@router.post("/generate-house-chores")
def generate_house_chores_for_users(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Generate chores for the current user's house using Gemini AI.
    Chores are assigned to users and returned grouped by user_id.

    Response format:
    {
        "chores_by_user": {
            "user_id_1": {
                "user_name": "...",
                "chores": [...],
                "weekly_score": ...,
                "chore_count": ...
            },
            "user_id_2": { ... }
        },
        "fairness_summary": { ... }
    }
    """
    if not current_user.house_id:
        raise HTTPException(status_code=400, detail="You must belong to a house first.")

    result = generate_house_chores(db, current_user.house_id)

    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])

    return result


# TODO: Add an api to create new tickets after generated/edited chores


@router.post("/generate-monthly-batch")
def generate_tickets(
    month: int,
    year: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Triggers the batch ticket generation logic.
    In production, this is usually called by a cron job (system timer), not a user button.
    """
    result = generate_monthly_tickets(db, current_user.house_id, year, month)
    return result


@router.patch("/ticket/{ticket_id}")
def update_ticket_status(
    ticket_id: int, update: TicketUpdate, db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.status = update.status
    if update.status == "Completed":
        from datetime import datetime

        ticket.completed_at = datetime.now()

    db.commit()
    return {"status": "updated", "new_state": ticket.status}


@router.get("/my-tickets")
def get_my_tickets(
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    tickets = (
        db.query(Ticket)
        .filter(
            Ticket.assigned_user_id == current_user.id,
            Ticket.status != "Completed",
        )
        .all()
    )
    return tickets
