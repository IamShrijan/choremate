from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from ...models.model import User, Ticket, Chore, Appreciation
from ...db.database import get_db
from ..dependencies import get_current_user


router = APIRouter(prefix="/stats", tags=["Gamification"])


@router.get("/leaderboard")
def get_leaderboard(
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    """
    Calculates points based on completed chores difficulty level.
    """
    results = (
        db.query(
            User.name,
            func.count(Ticket.id).label("tasks_done"),
            func.sum(Chore.difficulty_level).label("points"),
        )
        .join(Ticket, Ticket.assigned_user_id == User.id)
        .join(Chore, Ticket.chore_id == Chore.id)
        .filter(Ticket.status == "Completed")
        .filter(User.house_id == current_user.house_id)
        .group_by(User.id)
        .order_by(desc("points"))
        .all()
    )

    leaderboard = [{"user": r[0], "tasks": r[1], "points": r[2] or 0} for r in results]

    return leaderboard


@router.post("/appreciate/{ticket_id}")
def send_appreciation(
    ticket_id: int,
    message: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.assigned_user_id == current_user.id:
        raise HTTPException(
            status_code=400, detail="Nice try, but you can't appreciate yourself!"
        )

    appreciation = Appreciation(
        ticket_id=ticket_id, appreciated_by=current_user.id, message=message
    )
    db.add(appreciation)
    db.commit()
    return {"status": "Appreciation sent!"}
