from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from typing import List, Dict, Any
import math

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
    for the next 2 weeks based on chore duration (time commitment).

    Returns contribution percentages using softmax normalization.
    """
    if not current_user.house_id:
        raise HTTPException(status_code=400, detail="User is not part of any household")

    # Get current datetime
    now = datetime.utcnow()
    two_weeks_from_now = now + timedelta(weeks=2)

    # Get all users in the household
    house_users = db.query(User).filter(User.house_id == current_user.house_id).all()

    if not house_users:
        raise HTTPException(status_code=404, detail="No users found in household")

    # Calculate fairness score for each user
    user_contributions = []

    for user in house_users:
        # Get all tickets assigned to this user in the next 2 weeks
        tickets = (
            db.query(Ticket, Chore)
            .join(Chore, Ticket.chore_id == Chore.id)
            .filter(
                Ticket.assigned_user_id == user.id,
                Chore.house_id == current_user.house_id,
                Ticket.due_date >= now,
                Ticket.due_date <= two_weeks_from_now,
                Ticket.created_at <= now,  # Only include already created tickets
            )
            .all()
        )

        # Calculate total duration (fairness score) for this user
        total_duration = 0
        chore_details = []

        for ticket, chore in tickets:
            total_duration += chore.duration
            chore_details.append(
                {
                    "chore_name": chore.name,
                    "duration": chore.duration,
                    "difficulty": chore.difficulty_level,
                    "due_date": ticket.due_date.isoformat()
                    if ticket.due_date
                    else None,
                    "status": ticket.status,
                }
            )

        user_contributions.append(
            {
                "user_id": user.id,
                "user_name": user.name,
                "total_duration_minutes": total_duration,
                "chore_count": len(tickets),
                "chore_details": chore_details,
            }
        )

    # Calculate softmax for contribution percentages
    # Extract durations for softmax calculation
    durations = [uc["total_duration_minutes"] for uc in user_contributions]

    # Handle edge case: if all durations are 0
    if sum(durations) == 0:
        # Equal distribution if no one has chores
        contribution_percentages = [100.0 / len(durations) if durations else 0] * len(
            durations
        )
    else:
        # Apply softmax to get contribution percentages
        # Using temperature=1 for standard softmax
        # Scale durations to prevent overflow (optional but safe)
        max_duration = max(durations) if durations else 1
        scaled_durations = [d / max_duration for d in durations]

        # Calculate exp values
        exp_values = [math.exp(d) for d in scaled_durations]
        sum_exp = sum(exp_values)

        # Calculate softmax percentages
        contribution_percentages = [(exp_val / sum_exp) * 100 for exp_val in exp_values]

    # Add contribution percentage to each user's data
    for i, user_contrib in enumerate(user_contributions):
        user_contrib["contribution_percentage"] = round(contribution_percentages[i], 2)

    # Sort by contribution percentage (highest first)
    user_contributions.sort(key=lambda x: x["contribution_percentage"], reverse=True)

    return {
        "status": "success",
        "house_id": current_user.house_id,
        "report_period": {
            "start": now.isoformat(),
            "end": two_weeks_from_now.isoformat(),
        },
        "total_household_minutes": sum(durations),
        "user_contributions": user_contributions,
        "fairness_analysis": {
            "most_contributing": user_contributions[0]["user_name"]
            if user_contributions
            else None,
            "least_contributing": user_contributions[-1]["user_name"]
            if user_contributions
            else None,
            "average_contribution": round(100.0 / len(user_contributions), 2)
            if user_contributions
            else 0,
            "is_balanced": max(contribution_percentages) - min(contribution_percentages)
            < 20
            if contribution_percentages
            else True,
        },
    }
