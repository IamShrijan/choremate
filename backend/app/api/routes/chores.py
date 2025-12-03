from typing import List
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


@router.post("/add-chores")
def add_chores(
    chores: List[ChoreCreate],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Add multiple chores at once.
    """
    if not current_user.house_id:
        raise HTTPException(status_code=400, detail="You must belong to a house first.")

    created_chores = []
    for chore in chores:
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
        created_chores.append(new_chore)

    # Commit the changes to the database
    db.commit()

    # Refresh the created chores
    for chore in created_chores:
        db.refresh(chore)

    return {
        "status": "chores added to db",
        "chores_count": len(created_chores),
    }


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


@router.post("/generate-monthly-tickets")
def generate_monthly_tickets_for_house(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Generate monthly tickets for all chores in the house using AI.
    This creates fair assignments based on user preferences and chore data.
    """
    try:
        if not current_user.house_id:
            raise HTTPException(
                status_code=400, detail="You must belong to a house first."
            )

        result = generate_monthly_tickets(db, current_user.house_id)

        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])

        return result
    except HTTPException:
        raise
    except Exception as e:
        # Log the error for debugging
        print(f"Error generating monthly tickets: {str(e)}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


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
