from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from typing import List, Dict, Any
import math

from ...models.model import User, Ticket, Chore, Appreciation, Notification
from ...db.database import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/stats", tags=["Gamification"])


@router.get("/leaderboard")
def get_leaderboard(
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    """
    Calculate leaderboard based on completion rate for the current week (Sunday to Saturday).
    Rating = (completed tasks / total tasks assigned) × 5
    Returns users ordered by highest rating first.
    """
    if not current_user.house_id:
        raise HTTPException(status_code=400, detail="User is not part of any household")

    # Get current datetime and calculate week range (Sunday to Saturday)
    now = datetime.utcnow()
    current_date = now.date()

    # Get weekday (Monday=0, Tuesday=1, ..., Sunday=6)
    weekday = current_date.weekday()

    # Calculate days back to get to Sunday (start of week)
    # Monday=0 -> 1 day back, Tuesday=1 -> 2 days back, ..., Sunday=6 -> 0 days back
    days_back = (weekday + 1) % 7

    # Calculate Sunday (start of week) at 00:00:00
    week_start = datetime.combine(
        current_date - timedelta(days=days_back), datetime.min.time()
    )

    # Calculate Saturday (end of week) at 23:59:59
    week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)

    # Get all users in the household
    house_users = db.query(User).filter(User.house_id == current_user.house_id).all()

    if not house_users:
        raise HTTPException(status_code=404, detail="No users found in household")

    leaderboard_data = []

    for user in house_users:
        # Get all tickets assigned to this user for the current week (Sunday to Saturday)
        all_tickets = (
            db.query(Ticket)
            .join(Chore, Ticket.chore_id == Chore.id)
            .filter(
                Ticket.assigned_user_id == user.id,
                Chore.house_id == current_user.house_id,
                Ticket.due_date >= week_start,
                Ticket.due_date <= week_end,
            )
            .all()
        )

        # Count completed tickets
        completed_tickets = [t for t in all_tickets if t.status == "Completed"]

        total_tasks = len(all_tickets)
        completed_tasks = len(completed_tickets)

        # Calculate rating: (completed / total) × 5, rounded to 1 decimal
        if total_tasks > 0:
            rating = round((completed_tasks / total_tasks) * 5, 1)
            # Cap rating at 5.0
            rating = min(rating, 5.0)
        else:
            rating = 0.0

        leaderboard_data.append(
            {
                "user_id": user.id,
                "user_name": user.name,
                "email": user.email,
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "rating": rating,
            }
        )

    # Sort by rating (highest first)
    leaderboard_data.sort(key=lambda x: x["rating"], reverse=True)

    # Add rank based on sorted position
    for idx, entry in enumerate(leaderboard_data):
        entry["rank"] = idx + 1

    return {
        "status": "success",
        "leaderboard": leaderboard_data,
        "report_period": {
            "start": week_start.isoformat(),
            "end": week_end.isoformat(),
        },
    }


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


@router.get("/appreciation-history")
def get_appreciation_history(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """
    Get appreciation history for the current user.
    """
    appreciation_history = (
        db.query(Appreciation)
        .filter(Appreciation.appreciated_by == current_user.id)
        .all()
    )
    return appreciation_history


@router.get("/fairness-report")
def get_fairness_report(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """
    Calculate fairness report showing each household member's contribution
    for the entire month based on chore duration (time commitment in minutes).

    Returns:
    - Total planned effort (all assigned tickets for the month)
    - Completed effort (completed tickets)
    - Chore counts
    """
    if not current_user.house_id:
        raise HTTPException(status_code=400, detail="User is not part of any household")

    # Get current datetime and calculate month end
    now = datetime.utcnow()
    # Get first day of current month
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # Get last day of current month (approximate 30 days from month start)
    month_end = month_start + timedelta(days=30)

    # Get all users in the household
    house_users = db.query(User).filter(User.house_id == current_user.house_id).all()

    if not house_users:
        raise HTTPException(status_code=404, detail="No users found in household")

    # Calculate fairness data for each user
    user_contributions = []
    total_household_minutes = 0  # NEW: Track total household minutes

    for user in house_users:
        # Get all tickets assigned to this user for the current month (all statuses)
        all_tickets = (
            db.query(Ticket, Chore)
            .join(Chore, Ticket.chore_id == Chore.id)
            .filter(
                Ticket.assigned_user_id == user.id,
                Chore.house_id == current_user.house_id,
                Ticket.due_date >= month_start,
                Ticket.due_date <= month_end,
            )
            .all()
        )

        # Calculate total planned effort (all assigned tickets) - this is the purple bar value
        total_planned_minutes = sum(chore.duration for _, chore in all_tickets)

        # Add to household total
        total_household_minutes += total_planned_minutes

        user_contributions.append(
            {
                "user_id": user.id,
                "user_name": user.name,
                "total_planned_minutes": total_planned_minutes,  # Effort assigned to this person
                "chore_count": len(
                    all_tickets
                ),  # Number of chores assigned to this person
            }
        )

    return {
        "status": "success",
        "house_id": current_user.house_id,
        "report_period": {
            "start": month_start.isoformat(),
            "end": month_end.isoformat(),
        },
        "total_household_minutes": total_household_minutes,  # NEW: Total for all users
        "user_contributions": user_contributions,
    }


@router.get("/dashboard")
def get_dashboard_stats(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """
    Get statistics for the dashboard tiles:
    1. Pending chores count for the current week
    2. Completed chores count for the current week
    3. Appreciations received for the current month
    """
    if not current_user.house_id:
        # Return zeros if not in a house
        return {
            "pending_chores_week": 0,
            "completed_chores_week": 0,
            "appreciations_month": 0,
        }

    now = datetime.utcnow()
    current_date = now.date()

    # --- Week Range (Sunday to Saturday) ---
    weekday = current_date.weekday()
    days_back = (weekday + 1) % 7
    week_start = datetime.combine(
        current_date - timedelta(days=days_back), datetime.min.time()
    )
    week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)

    # --- Month Range ---
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # Simple month end calculation (next month start - 1 second)
    if now.month == 12:
        next_month = now.replace(year=now.year + 1, month=1, day=1)
    else:
        next_month = now.replace(month=now.month + 1, day=1)
    month_end = next_month - timedelta(seconds=1)

    # 1. Pending Chores (Due this week, not completed)
    pending_count = (
        db.query(Ticket)
        .join(Chore, Ticket.chore_id == Chore.id)
        .filter(
            Ticket.assigned_user_id == current_user.id,
            Chore.house_id == current_user.house_id,
            Ticket.due_date >= week_start,
            Ticket.due_date <= week_end,
            Ticket.status != "Completed",
        )
        .count()
    )

    # 2. Completed Chores (Completed this week, regardless of due date)
    completed_count = (
        db.query(Ticket)
        .join(Chore, Ticket.chore_id == Chore.id)
        .filter(
            Ticket.assigned_user_id == current_user.id,
            Chore.house_id == current_user.house_id,
            Ticket.status == "Completed",
            Ticket.completed_at >= week_start,
            Ticket.completed_at <= week_end,
        )
        .count()
    )

    # 3. Appreciations (Month)
    # Count AppreciationEvent records created this month
    from ...models.model import AppreciationEvent

    appreciations_count = (
        db.query(AppreciationEvent)
        .filter(
            AppreciationEvent.recipient_id == current_user.id,
            AppreciationEvent.created_at >= month_start,
            AppreciationEvent.created_at <= month_end,
        )
        .count()
    )

    return {
        "pending_chores_week": pending_count,
        "completed_chores_week": completed_count,
        "appreciations_month": appreciations_count,
    }
