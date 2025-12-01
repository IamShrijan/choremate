from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import json
import uuid
from pydantic import BaseModel, Field

from google import genai
from google.genai import types

from ...schemas.chatbot import (
    ChatMessage,
    ChatResponse,
    AIIntentAnalysis,
    ProposedAction,
    ActionApproval,
    SwapRequestCreate,
    SwapRequestResponse,
    NotificationResponse,
)
from ...models.model import (
    User,
    Ticket,
    Chore,
    UserPreference,
    SwapRequest,
    Notification,
)
from ...db.database import get_db
from ..dependencies import get_current_user
from ...core.generate_house_chores import get_gemini_client

router = APIRouter(prefix="/ai-chatbot", tags=["AI Chatbot"])


# In-memory store for pending actions (in production, use Redis or database)
pending_actions: Dict[str, Dict[str, Any]] = {}

# Action expiration time (30 minutes)
ACTION_EXPIRATION_MINUTES = 30


def cleanup_expired_actions():
    """Remove expired pending actions"""
    now = datetime.utcnow()
    expired_ids = []

    for action_id, action_data in pending_actions.items():
        created_at = datetime.fromisoformat(action_data["created_at"])
        if (now - created_at).total_seconds() > ACTION_EXPIRATION_MINUTES * 60:
            expired_ids.append(action_id)

    for action_id in expired_ids:
        del pending_actions[action_id]

    return len(expired_ids)


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

    user_workloads.sort(key=lambda x: x["total_duration_minutes"])
    return {"users": user_workloads, "total_users": len(user_workloads)}


def find_best_swap_candidate(
    db: Session, ticket_id: str, requester_id: str, house_id: str
) -> Dict[str, Any]:
    """Find the best person to swap with based on fairness and preferences"""

    ticket_data = (
        db.query(Ticket, Chore)
        .join(Chore, Ticket.chore_id == Chore.id)
        .filter(Ticket.id == ticket_id)
        .first()
    )

    if not ticket_data:
        return {"error": "Ticket not found"}

    ticket, chore = ticket_data

    # Verify the ticket belongs to the requester
    if ticket.assigned_user_id != requester_id:
        return {"error": "You can only swap your own chores"}

    fairness_data = get_fairness_data(db, house_id)

    # Check if there are other users in the house
    if fairness_data["total_users"] <= 1:
        return {"error": "No other users in household to swap with"}

    candidates = []
    for user_data in fairness_data["users"]:
        if user_data["user_id"] == requester_id:
            continue

        user_pref = (
            db.query(UserPreference)
            .filter(UserPreference.user_id == user_data["user_id"])
            .first()
        )

        chore_preference = "neutral"
        if user_pref and user_pref.chore_preferences:
            chore_preference = user_pref.chore_preferences.get(chore.name, "neutral")

        preference_score = {"dont mind": 3, "neutral": 2, "prefer to avoid": 1}.get(
            chore_preference, 2
        )

        # Handle edge case where all users have 0 workload
        max_workload = max(
            [u["total_duration_minutes"] for u in fairness_data["users"]]
        )
        if max_workload == 0:
            workload_score = 1.0  # Equal score if no one has work
        else:
            workload_score = (
                max_workload - user_data["total_duration_minutes"] + 1
            ) / (max_workload + 1)

        suitability = (preference_score * 0.4) + (workload_score * 0.6)

        candidates.append(
            {
                "user_id": user_data["user_id"],
                "user_name": user_data["user_name"],
                "current_workload": user_data["total_duration_minutes"],
                "chore_preference": chore_preference,
                "suitability_score": round(suitability, 2),
            }
        )

    candidates.sort(key=lambda x: x["suitability_score"], reverse=True)

    if not candidates:
        return {"error": "No suitable candidates found"}

    return {
        "chore_name": chore.name,
        "chore_duration": chore.duration,
        "chore_difficulty": chore.difficulty_level,
        "due_date": ticket.due_date.isoformat() if ticket.due_date else None,
        "candidates": candidates,
    }


@router.post("/chat", response_model=ChatResponse)
def chat_with_ai(
    message: ChatMessage,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Main chatbot endpoint - AI analyzes intent and proposes actions but doesn't execute without approval
    """

    if not current_user.house_id:
        return ChatResponse(
            response="You need to join a household first to use the AI assistant for chore management.",
            intent="general_query",
            proposed_action=None,
            executed_action=None,
            conversation_id=str(uuid.uuid4()),
        )

    conversation_id = message.conversation_id or str(uuid.uuid4())

    try:
        client = get_gemini_client()

        # Build context about user's current situation
        my_tickets = (
            db.query(Ticket, Chore)
            .join(Chore, Ticket.chore_id == Chore.id)
            .filter(
                Ticket.assigned_user_id == current_user.id,
                Ticket.status == "Pending",
                Ticket.due_date >= datetime.utcnow(),
            )
            .limit(10)
            .all()
        )

        chores_context = json.dumps(
            [
                {
                    "ticket_id": ticket.id,
                    "chore_name": chore.name,
                    "due_date": ticket.due_date.isoformat()
                    if ticket.due_date
                    else None,
                    "duration": chore.duration,
                    "difficulty": chore.difficulty_level,
                    "priority": chore.chore_priority,
                    "notes": chore.notes,
                }
                for ticket, chore in my_tickets
            ],
            indent=2,
        )

        prompt = f"""
You are ChoreMate AI, a helpful household chore management assistant.

IMPORTANT: You are an AGENT that PROPOSES actions but NEVER executes them without explicit user approval.

User Information:
- Name: {current_user.name}
- House ID: {current_user.house_id}

User's Upcoming Chores:
{chores_context}

Available Intents/Tools:
1. "request_swap" - User wants to swap a chore (REQUIRES APPROVAL)
2. "get_my_chores" - User asks about their chores (NO APPROVAL NEEDED)
3. "get_fairness_report" - User asks about workload distribution (NO APPROVAL NEEDED)
4. "general_query" - General questions or conversation (NO APPROVAL NEEDED)

User Query: "{message.message}"

TASK:
Analyze the user's query and determine:
1. What is their intent?
2. What parameters can you extract?
3. How confident are you? (0.0 to 1.0)
4. What's your reasoning?
5. What friendly message should we show them?

IMPORTANT RULES:
- If intent is "request_swap", you MUST identify the ticket_id from the context
- If you're not sure which chore they mean, ask for clarification (use "general_query" with low confidence)
- Extract the reason for swapping if mentioned
- Be conversational and helpful in your user_message

Return your analysis in the specified JSON structure.
"""

        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AIIntentAnalysis.model_json_schema(),
                thinking_config=types.ThinkingConfig(include_thoughts=True),
            ),
        )

        intent_analysis = AIIntentAnalysis.model_validate_json(response.text)

        # Now handle based on intent
        proposed_action = None
        executed_action = None
        ai_response = intent_analysis.user_message

        # Actions that require approval
        if intent_analysis.intent == "request_swap":
            ticket_id = intent_analysis.parameters.get("ticket_id")
            reason = intent_analysis.parameters.get("reason", "Requested by user")

            if not ticket_id:
                ai_response = (
                    "I understand you want to swap a chore, but I couldn't identify which one. Could you tell me which chore you'd like to swap? Here are your upcoming chores:\n\n"
                    + "\n".join(
                        [
                            f"- {chore.name} (Due: {ticket.due_date.strftime('%b %d') if ticket.due_date else 'TBD'})"
                            for ticket, chore in my_tickets
                        ]
                    )
                )
            else:
                # Find best candidate
                swap_analysis = find_best_swap_candidate(
                    db, ticket_id, current_user.id, current_user.house_id
                )

                if "error" in swap_analysis:
                    # Handle specific errors
                    ai_response = f"Sorry, I couldn't process the swap request: {swap_analysis['error']}"
                elif swap_analysis.get("candidates"):
                    best_candidate = swap_analysis["candidates"][0]
                    action_id = str(uuid.uuid4())

                    # Store pending action
                    pending_actions[action_id] = {
                        "type": "swap_request",
                        "ticket_id": ticket_id,
                        "requester_id": current_user.id,
                        "target_user_id": best_candidate["user_id"],
                        "reason": reason,
                        "swap_analysis": swap_analysis,
                        "house_id": current_user.house_id,
                        "created_at": datetime.utcnow().isoformat(),
                    }

                    # Create proposed action
                    proposed_action = ProposedAction(
                        action_id=action_id,
                        action_type="swap_request",
                        title=f"Swap '{swap_analysis['chore_name']}' with {best_candidate['user_name']}",
                        description=f"I'll send a swap request to {best_candidate['user_name']} for the chore '{swap_analysis['chore_name']}' (due {swap_analysis.get('due_date', 'TBD')}).",
                        details={
                            "chore_name": swap_analysis["chore_name"],
                            "chore_duration": swap_analysis["chore_duration"],
                            "chore_difficulty": swap_analysis.get("chore_difficulty"),
                            "due_date": swap_analysis.get("due_date"),
                            "target_user": best_candidate["user_name"],
                            "target_workload": best_candidate["current_workload"],
                            "their_preference": best_candidate["chore_preference"],
                            "suitability_score": best_candidate["suitability_score"],
                            "all_candidates": swap_analysis["candidates"][:3],  # Top 3
                        },
                        ai_reasoning=f"{best_candidate['user_name']} is the best match because they have {best_candidate['current_workload']} minutes of chores (lighter workload) and their preference for '{swap_analysis['chore_name']}' is '{best_candidate['chore_preference']}'. Suitability score: {best_candidate['suitability_score']}/3.0",
                        requires_approval=True,
                    )

                    # Build alternative candidates string if there are more
                    alternatives_str = ""
                    if len(swap_analysis["candidates"]) > 1:
                        alternatives = swap_analysis["candidates"][1:3]  # Next 2 best
                        alternatives_str = "\n\n**Other options:**\n" + "\n".join(
                            [
                                f"• {c['user_name']} (workload: {c['current_workload']}min, preference: {c['chore_preference']}, score: {c['suitability_score']})"
                                for c in alternatives
                            ]
                        )

                    ai_response = f"I've analyzed your request to swap **'{swap_analysis['chore_name']}'** (duration: {swap_analysis['chore_duration']} min, difficulty: {swap_analysis.get('chore_difficulty', 'N/A')}).\n\nBased on fairness and preferences, I recommend sending the request to **{best_candidate['user_name']}**.\n\n📊 **Why {best_candidate['user_name']}?**\n• Current workload: {best_candidate['current_workload']} minutes\n• Their preference for this chore: *{best_candidate['chore_preference']}*\n• Match score: **{best_candidate['suitability_score']}/3.0**{alternatives_str}\n\n✅ **Approve** to send the swap request, or ❌ **Reject** to cancel."
                else:
                    ai_response = "I couldn't find a suitable person to swap this chore with based on current workloads and preferences. Would you like to see the fairness report?"

        # Actions that don't require approval (informational)
        elif intent_analysis.intent == "get_my_chores":
            chores_list = [
                f"- **{chore.name}** (Due: {ticket.due_date.strftime('%b %d, %I:%M %p') if ticket.due_date else 'TBD'}, {chore.duration} min, Priority: {chore.chore_priority})"
                for ticket, chore in my_tickets
            ]
            executed_action = {"chores_count": len(my_tickets), "chores": chores_list}
            ai_response = (
                "Here are your upcoming chores:\n\n" + "\n".join(chores_list)
                if chores_list
                else "You have no pending chores! 🎉"
            )

        elif intent_analysis.intent == "get_fairness_report":
            fairness = get_fairness_data(db, current_user.house_id)
            report_lines = [
                f"- **{u['user_name']}**: {u['total_duration_minutes']} minutes ({u['ticket_count']} chores)"
                for u in fairness["users"]
            ]
            executed_action = fairness
            ai_response = (
                "Here's your household workload distribution for the next 2 weeks:\n\n"
                + "\n".join(report_lines)
            )

        return ChatResponse(
            response=ai_response,
            intent=intent_analysis.intent,
            proposed_action=proposed_action,
            executed_action=executed_action,
            conversation_id=conversation_id,
        )

    except Exception as e:
        return ChatResponse(
            response=f"I encountered an error: {str(e)}. Please try again or rephrase your question.",
            intent="general_query",
            proposed_action=None,
            executed_action=None,
            conversation_id=conversation_id,
        )


@router.post("/approve-action", response_model=ChatResponse)
def approve_action(
    approval: ActionApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Execute a proposed action after user approval
    """

    # Clean up expired actions first
    cleanup_expired_actions()

    action_data = pending_actions.get(approval.action_id)

    if not action_data:
        raise HTTPException(status_code=404, detail="Action not found or expired")

    # Verify ownership
    if action_data["requester_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not approval.approved:
        # User rejected the action
        del pending_actions[approval.action_id]
        return ChatResponse(
            response="Action cancelled. Is there anything else I can help you with?",
            intent="general_query",
            proposed_action=None,
            executed_action={"cancelled": True},
            conversation_id=approval.conversation_id,
        )

    # Execute the approved action
    if action_data["type"] == "swap_request":
        swap_analysis = action_data["swap_analysis"]

        # Verify the ticket still exists and is still assigned to the requester
        ticket = db.query(Ticket).filter(Ticket.id == action_data["ticket_id"]).first()
        if not ticket:
            del pending_actions[approval.action_id]
            raise HTTPException(status_code=404, detail="Ticket no longer exists")

        if ticket.assigned_user_id != action_data["requester_id"]:
            del pending_actions[approval.action_id]
            raise HTTPException(
                status_code=400, detail="This ticket is no longer assigned to you"
            )

        if ticket.status != "Pending":
            del pending_actions[approval.action_id]
            raise HTTPException(
                status_code=400,
                detail="This ticket has already been completed or cancelled",
            )

        # Check if there's already a pending swap request for this ticket
        existing_swap = (
            db.query(SwapRequest)
            .filter(
                SwapRequest.ticket_id == action_data["ticket_id"],
                SwapRequest.status == "Pending",
            )
            .first()
        )

        if existing_swap:
            del pending_actions[approval.action_id]
            raise HTTPException(
                status_code=400,
                detail="There's already a pending swap request for this chore",
            )

        best_candidate = swap_analysis["candidates"][0]

        # Verify target user still exists
        target_user = (
            db.query(User).filter(User.id == action_data["target_user_id"]).first()
        )
        if not target_user:
            del pending_actions[approval.action_id]
            raise HTTPException(status_code=404, detail="Target user no longer exists")

        # Create swap request in database
        swap_request = SwapRequest(
            ticket_id=action_data["ticket_id"],
            requester_user_id=action_data["requester_id"],
            target_user_id=action_data["target_user_id"],
            reason=action_data["reason"],
            status="Pending",
            ai_analysis=swap_analysis,
        )
        db.add(swap_request)
        db.commit()
        db.refresh(swap_request)

        # Create notification for target user
        notification = Notification(
            user_id=action_data["target_user_id"],
            notification_type="swap_request",
            title="Chore Swap Request",
            message=f"{current_user.name} wants to swap the '{swap_analysis['chore_name']}' chore with you. Reason: {action_data['reason']}",
            related_id=swap_request.id,
            is_read=0,
        )
        db.add(notification)
        db.commit()

        # Clean up pending action
        del pending_actions[approval.action_id]

        executed_action = {
            "swap_request_id": swap_request.id,
            "target_user": best_candidate["user_name"],
            "chore_name": swap_analysis["chore_name"],
            "status": "sent",
        }

        ai_response = f"✅ Swap request sent to **{best_candidate['user_name']}**! They'll receive a notification and can accept or decline. I'll let you know when they respond."

        return ChatResponse(
            response=ai_response,
            intent="request_swap",
            proposed_action=None,
            executed_action=executed_action,
            conversation_id=approval.conversation_id,
        )

    raise HTTPException(status_code=400, detail="Unknown action type")


@router.get("/notifications", response_model=List[NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get all notifications for the current user"""
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )

    return [
        NotificationResponse(
            id=n.id,
            notification_type=n.notification_type,
            title=n.title,
            message=n.message,
            related_id=n.related_id,
            is_read=bool(n.is_read),
            created_at=n.created_at,
        )
        for n in notifications
    ]


@router.post("/notifications/{notification_id}/mark-read")
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a notification as read"""
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id, Notification.user_id == current_user.id
        )
        .first()
    )

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = 1
    db.commit()

    return {"status": "success", "message": "Notification marked as read"}


@router.post("/swap-requests/{swap_request_id}/respond")
def respond_to_swap_request(
    swap_request_id: str,
    accept: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept or reject a swap request"""
    swap_request = (
        db.query(SwapRequest)
        .filter(
            SwapRequest.id == swap_request_id,
            SwapRequest.target_user_id == current_user.id,
            SwapRequest.status == "Pending",
        )
        .first()
    )

    if not swap_request:
        raise HTTPException(
            status_code=404, detail="Swap request not found or already processed"
        )

    # Get the ticket and chore details for better notifications
    ticket_data = (
        db.query(Ticket, Chore)
        .join(Chore, Ticket.chore_id == Chore.id)
        .filter(Ticket.id == swap_request.ticket_id)
        .first()
    )

    if not ticket_data:
        swap_request.status = "Rejected"
        swap_request.responded_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=404, detail="Ticket no longer exists")

    ticket, chore = ticket_data

    if accept:
        # Verify ticket is still assigned to the requester
        if ticket.assigned_user_id != swap_request.requester_user_id:
            swap_request.status = "Rejected"
            swap_request.responded_at = datetime.utcnow()
            db.commit()
            raise HTTPException(
                status_code=400, detail="Ticket is no longer assigned to the requester"
            )

        # Verify ticket is still pending
        if ticket.status != "Pending":
            swap_request.status = "Rejected"
            swap_request.responded_at = datetime.utcnow()
            db.commit()
            raise HTTPException(
                status_code=400, detail="Ticket has already been completed or cancelled"
            )

        # Execute the swap
        original_user_id = ticket.assigned_user_id
        ticket.assigned_user_id = current_user.id
        swap_request.status = "Accepted"
        swap_request.responded_at = datetime.utcnow()

        # Notify the requester
        requester_notification = Notification(
            user_id=swap_request.requester_user_id,
            notification_type="swap_accepted",
            title="Swap Request Accepted!",
            message=f"{current_user.name} accepted your swap request for '{chore.name}'!",
            related_id=swap_request_id,
            is_read=0,
        )
        db.add(requester_notification)
        db.commit()

        return {
            "status": "success",
            "message": f"Swap completed successfully! You now have '{chore.name}' assigned to you.",
            "ticket_id": ticket.id,
            "chore_name": chore.name,
            "chore_duration": chore.duration,
            "due_date": ticket.due_date.isoformat() if ticket.due_date else None,
        }
    else:
        swap_request.status = "Rejected"
        swap_request.responded_at = datetime.utcnow()

        # Notify the requester
        requester_notification = Notification(
            user_id=swap_request.requester_user_id,
            notification_type="swap_rejected",
            title="Swap Request Declined",
            message=f"{current_user.name} declined your swap request for '{chore.name}'.",
            related_id=swap_request_id,
            is_read=0,
        )
        db.add(requester_notification)
        db.commit()

        return {
            "status": "success",
            "message": "Swap request declined",
            "chore_name": chore.name,
        }


@router.get("/swap-requests/pending")
def get_pending_swap_requests(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get all pending swap requests for the current user"""
    swap_requests = (
        db.query(SwapRequest, Ticket, Chore, User)
        .join(Ticket, SwapRequest.ticket_id == Ticket.id)
        .join(Chore, Ticket.chore_id == Chore.id)
        .join(User, SwapRequest.requester_user_id == User.id)
        .filter(
            SwapRequest.target_user_id == current_user.id,
            SwapRequest.status == "Pending",
        )
        .all()
    )

    return [
        {
            "swap_request_id": sr.id,
            "requester_name": user.name,
            "chore_name": chore.name,
            "chore_description": chore.description,
            "chore_duration": chore.duration,
            "chore_difficulty": chore.difficulty_level,
            "due_date": ticket.due_date.isoformat() if ticket.due_date else None,
            "reason": sr.reason,
            "created_at": sr.created_at.isoformat(),
            "ai_analysis": sr.ai_analysis,
        }
        for sr, ticket, chore, user in swap_requests
    ]


@router.get("/pending-actions")
def get_user_pending_actions(current_user: User = Depends(get_current_user)):
    """Get all pending actions (proposals) for the current user"""
    # Clean up expired actions first
    cleanup_expired_actions()

    user_actions = []
    for action_id, action_data in pending_actions.items():
        if action_data["requester_id"] == current_user.id:
            user_actions.append(
                {
                    "action_id": action_id,
                    "action_type": action_data["type"],
                    "created_at": action_data["created_at"],
                    "details": {
                        "chore_name": action_data.get("swap_analysis", {}).get(
                            "chore_name"
                        ),
                        "target_user_id": action_data.get("target_user_id"),
                        "reason": action_data.get("reason"),
                    },
                }
            )

    return {"pending_actions": user_actions, "count": len(user_actions)}
