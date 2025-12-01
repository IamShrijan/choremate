from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import json

from google import genai
from google.genai import types


from app.schemas.chatbot import (
    ChatMessage,
    ChatResponse,
    SwapRequestCreate,
    SwapRequestResponse,
    NotificationResponse,
)
from app.models.model import (
    User,
    Ticket,
    Chore,
    UserPreference,
    SwapRequest,
    Notification,
)
from app.db.database import get_db
from app.api.dependencies import get_current_user
from app.core.generate_house_chores import get_gemini_client


# Tool definitions for Gemini
CHATBOT_TOOLS = {
    "request_swap": {
        "description": "Request to swap a chore ticket with another household member",
        "parameters": {
            "ticket_id": "The ID of the ticket to swap",
            "reason": "Reason for requesting the swap",
        },
    },
    "get_my_chores": {
        "description": "Get the current user's upcoming chores",
        "parameters": {},
    },
    "get_fairness_report": {
        "description": "Get the household fairness report showing everyone's workload",
        "parameters": {},
    },
    "general_query": {
        "description": "Answer general questions about chores, household tasks, or provide information",
        "parameters": {"query": "The user's question"},
    },
}


def get_fairness_data(db: Session, house_id: str) -> Dict[str, Any]:
    """Get fairness report data for AI decision making"""
    now = datetime.utcnow()
    two_weeks_from_now = now + timedelta(weeks=2)

    house_users = db.query(User).filter(User.house_id == house_id).all()

    user_workloads = []
    for user in house_users:
        tickets = (
            db.query(Ticket, Chore)
            .join(Chore, Ticket.chore_id == Chore.id)
            .filter(
                Ticket.assigned_user_id == user.id,
                Chore.house_id == house_id,
                Ticket.due_date >= now,
                Ticket.due_date <= two_weeks_from_now,
                Ticket.status == "Pending",
            )
            .all()
        )

        total_duration = sum(chore.duration for _, chore in tickets)

        user_workloads.append(
            {
                "user_id": user.id,
                "user_name": user.name,
                "total_duration_minutes": total_duration,
                "ticket_count": len(tickets),
            }
        )

    # Sort by workload (ascending - least busy first)
    user_workloads.sort(key=lambda x: x["total_duration_minutes"])

    return {"users": user_workloads, "total_users": len(user_workloads)}


def find_best_swap_candidate(
    db: Session, ticket_id: str, requester_id: str, house_id: str
) -> Dict[str, Any]:
    """Find the best person to swap with based on fairness and preferences"""

    # Get the ticket details
    ticket_data = (
        db.query(Ticket, Chore)
        .join(Chore, Ticket.chore_id == Chore.id)
        .filter(Ticket.id == ticket_id)
        .first()
    )

    if not ticket_data:
        return {"error": "Ticket not found"}

    ticket, chore = ticket_data

    # Get fairness data
    fairness_data = get_fairness_data(db, house_id)

    # Find suitable candidates (excluding requester)
    candidates = []
    for user_data in fairness_data["users"]:
        if user_data["user_id"] == requester_id:
            continue

        # Get user preferences
        user_pref = (
            db.query(UserPreference)
            .filter(UserPreference.user_id == user_data["user_id"])
            .first()
        )

        # Check chore preference
        chore_preference = "neutral"
        if user_pref and user_pref.chore_preferences:
            chore_preference = user_pref.chore_preferences.get(chore.name, "neutral")

        # Calculate suitability score
        # Lower workload = higher suitability
        # "dont mind" > "neutral" > "prefer to avoid"
        preference_score = {"dont mind": 3, "neutral": 2, "prefer to avoid": 1}.get(
            chore_preference, 2
        )

        # Inverse workload score (less work = better candidate)
        max_workload = max(
            [u["total_duration_minutes"] for u in fairness_data["users"]]
        )
        workload_score = (max_workload - user_data["total_duration_minutes"] + 1) / (
            max_workload + 1
        )

        suitability = (preference_score * 0.4) + (workload_score * 0.6)

        candidates.append(
            {
                "user_id": user_data["user_id"],
                "user_name": user_data["user_name"],
                "current_workload": user_data["total_duration_minutes"],
                "chore_preference": chore_preference,
                "suitability_score": suitability,
            }
        )

    # Sort by suitability (highest first)
    candidates.sort(key=lambda x: x["suitability_score"], reverse=True)

    return {
        "chore_name": chore.name,
        "chore_duration": chore.duration,
        "candidates": candidates,
    }
