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


def get_user_chores(db: Session, user_id: str, house_id: str) -> List[Dict[str, Any]]:
    """Get all pending chores for a user"""
    now = datetime.utcnow()

    tickets = (
        db.query(Ticket, Chore)
        .join(Chore, Ticket.chore_id == Chore.id)
        .filter(
            Ticket.assigned_user_id == user_id,
            Chore.house_id == house_id,
            Ticket.status == "Pending",
            Ticket.due_date >= now,
        )
        .order_by(Ticket.due_date)
        .all()
    )

    return [
        {
            "ticket_id": ticket.id,
            "chore_name": chore.name,
            "chore_description": chore.description,
            "due_date": ticket.due_date.strftime("%Y-%m-%d")
            if ticket.due_date
            else None,
            "due_date_display": ticket.due_date.strftime("%b %d, %Y")
            if ticket.due_date
            else "TBD",
            "duration": chore.duration,
            "difficulty": chore.difficulty_level,
            "priority": chore.chore_priority,
        }
        for ticket, chore in tickets
    ]


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

        # Get user preferences
        user_pref = (
            db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
        )
        day_availability = user_pref.day_availability if user_pref else []
        time_availability = user_pref.time_availability if user_pref else []

        user_workloads.append(
            {
                "user_id": user.id,
                "user_name": user.name,
                "total_duration_minutes": total_duration,
                "ticket_count": len(tickets),
                "day_availability": day_availability,
                "time_availability": time_availability,
            }
        )

    user_workloads.sort(key=lambda x: x["total_duration_minutes"])
    return {"users": user_workloads, "total_users": len(user_workloads)}


def find_best_reassignment_candidate(
    db: Session, ticket_id: str, requester_id: str, house_id: str
) -> Dict[str, Any]:
    """Find the best person to reassign a chore to based on fairness and preferences"""

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
        return {"error": "You can only reassign your own chores"}

    fairness_data = get_fairness_data(db, house_id)

    # Check if there are other users in the house
    if fairness_data["total_users"] <= 1:
        return {"error": "No other users in household to reassign to"}

    # Get the due date day of week
    due_day = ticket.due_date.strftime("%A") if ticket.due_date else None

    candidates = []
    for user_data in fairness_data["users"]:
        if user_data["user_id"] == requester_id:
            continue

        # Check if user is available on the due date
        is_available = True
        availability_note = "Available"
        if due_day and user_data["day_availability"]:
            if due_day not in user_data["day_availability"]:
                is_available = False
                availability_note = f"Not available on {due_day}"
            else:
                availability_note = f"Available on {due_day}"

        # Get user's preference for this chore type
        user_pref = (
            db.query(UserPreference)
            .filter(UserPreference.user_id == user_data["user_id"])
            .first()
        )

        chore_preference = "neutral"
        if user_pref and user_pref.chore_preferences:
            chore_preference = user_pref.chore_preferences.get(chore.name, "neutral")

        preference_score = {
            "dont mind": 3,
            "like": 3,
            "neutral": 2,
            "prefer to avoid": 1,
            "dislike": 1,
        }.get(chore_preference.lower(), 2)

        # Calculate workload score (lower workload = higher score)
        max_workload = max(
            [u["total_duration_minutes"] for u in fairness_data["users"]]
        )
        if max_workload == 0:
            workload_score = 1.0
        else:
            workload_score = (
                max_workload - user_data["total_duration_minutes"] + 1
            ) / (max_workload + 1)

        # Calculate availability score
        availability_score = 1.0 if is_available else 0.3

        # Combined suitability score
        suitability = (
            (preference_score * 0.3)
            + (workload_score * 0.4)
            + (availability_score * 0.3)
        )

        candidates.append(
            {
                "user_id": user_data["user_id"],
                "user_name": user_data["user_name"],
                "current_workload_minutes": user_data["total_duration_minutes"],
                "current_chore_count": user_data["ticket_count"],
                "chore_preference": chore_preference,
                "is_available": is_available,
                "availability_note": availability_note,
                "day_availability": user_data["day_availability"],
                "suitability_score": round(suitability, 2),
            }
        )

    # Sort by suitability score (highest first)
    candidates.sort(key=lambda x: x["suitability_score"], reverse=True)

    if not candidates:
        return {"error": "No suitable candidates found"}

    return {
        "ticket_id": ticket_id,
        "chore_name": chore.name,
        "chore_description": chore.description,
        "chore_duration": chore.duration,
        "chore_difficulty": chore.difficulty_level,
        "due_date": ticket.due_date.strftime("%Y-%m-%d") if ticket.due_date else None,
        "due_date_display": ticket.due_date.strftime("%b %d, %Y")
        if ticket.due_date
        else "TBD",
        "candidates": candidates,
    }


# Define 5 dummy tools
DUMMY_TOOLS = {
    "get_my_chores": {
        "name": "get_my_chores",
        "description": "Get the user's upcoming chores and tasks",
        "parameters": {},
    },
    "reassign_chores": {
        "name": "reassign_chores",
        "description": "Reassign or reschedule chores for a specific date",
        "parameters": {"date": "string", "chore_ids": "list"},
    },
    "check_fairness": {
        "name": "check_fairness",
        "description": "Check workload fairness across household members",
        "parameters": {},
    },
    "swap_chore": {
        "name": "swap_chore",
        "description": "Swap a chore with another household member",
        "parameters": {"chore_id": "string", "reason": "string"},
    },
    "schedule_help": {
        "name": "schedule_help",
        "description": "Get help with scheduling and managing chore assignments",
        "parameters": {"query": "string"},
    },
}


def dummy_tool_get_my_chores(user_id: str, house_id: str) -> Dict[str, Any]:
    """Dummy tool that returns sample chore data"""
    return {
        "status": "success",
        "chores": [
            {
                "id": "chore1",
                "name": "Clean Kitchen",
                "due_date": "2024-01-15",
                "duration": 30,
            },
            {
                "id": "chore2",
                "name": "Take Out Trash",
                "due_date": "2024-01-16",
                "duration": 10,
            },
        ],
        "total_chores": 2,
    }


def dummy_tool_reassign_chores(date: str, chore_ids: list) -> Dict[str, Any]:
    """Dummy tool for reassigning chores"""
    return {
        "status": "success",
        "message": f"Successfully reassigned {len(chore_ids)} chore(s) to {date}",
        "reassigned_chores": chore_ids,
    }


def dummy_tool_check_fairness(house_id: str) -> Dict[str, Any]:
    """Dummy tool for checking fairness"""
    return {
        "status": "success",
        "fairness_score": 0.85,
        "distribution": [
            {"user": "User1", "workload": 120, "percentage": 30},
            {"user": "User2", "workload": 100, "percentage": 25},
        ],
    }


def dummy_tool_swap_chore(chore_id: str, reason: str) -> Dict[str, Any]:
    """Dummy tool for swapping chores"""
    return {
        "status": "success",
        "message": f"Swap request created for chore {chore_id}",
        "swap_id": "swap_12345",
    }


def dummy_tool_schedule_help(query: str) -> Dict[str, Any]:
    """Dummy tool for scheduling help"""
    return {
        "status": "success",
        "suggestions": [
            "You have 3 chores due this week",
            "Consider spacing them evenly throughout the week",
            "You can swap with roommates if needed",
        ],
    }


# Tool execution mapper
TOOL_EXECUTORS = {
    "get_my_chores": dummy_tool_get_my_chores,
    "reassign_chores": dummy_tool_reassign_chores,
    "check_fairness": dummy_tool_check_fairness,
    "swap_chore": dummy_tool_swap_chore,
    "schedule_help": dummy_tool_schedule_help,
}


@router.post("/chat", response_model=ChatResponse)
def chat_with_ai(
    message: ChatMessage,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Main chatbot endpoint with reassign chore workflow:
    1. First LLM call identifies intent and extracts chore details
    2. If reassign intent, fetch user's chores and fairness data
    3. AI recommends best candidate with reasoning
    4. User can approve or reject
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

        # Get user's current chores for context
        user_chores = get_user_chores(db, current_user.id, current_user.house_id)
        chores_context = json.dumps(user_chores, indent=2)

        # STEP 1: Intent Detection - Identify what the user wants
        intent_prompt = f"""
You are ChoreMate AI, a household chore management assistant.

User's Current Chores:
{chores_context}

User Query: "{message.message}"

TASK: Analyze the user's query and determine their intent.

Available Intents:
1. "reassign_chore" - User wants to reassign/transfer a chore to someone else
2. "get_my_chores" - User wants to see their upcoming chores
3. "general_query" - General questions or conversation

If the intent is "reassign_chore", you MUST extract:
- "chore_name": The name of the chore they want to reassign (match from their chores list)
- "ticket_id": The ticket_id from the chores list (if you can identify which chore)
- "reason": Why they want to reassign (if mentioned)

Return JSON with:
{{
    "intent": "reassign_chore" | "get_my_chores" | "general_query",
    "confidence": 0.0-1.0,
    "chore_name": "string or null",
    "ticket_id": "string or null",
    "reason": "string or null",
    "clarification_needed": true/false,
    "clarification_message": "string if clarification needed"
}}

IMPORTANT: If user mentions a chore but you can't match it exactly, set clarification_needed=true.
"""

        intent_response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=intent_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )

        intent_data = json.loads(intent_response.text)
        detected_intent = intent_data.get("intent", "general_query")

        # Handle reassign chore intent
        if detected_intent == "reassign_chore":
            ticket_id = intent_data.get("ticket_id")
            chore_name = intent_data.get("chore_name")
            reason = intent_data.get("reason", "User requested reassignment")

            # If clarification needed, ask user
            if intent_data.get("clarification_needed") or not ticket_id:
                chores_list = "\n".join(
                    [
                        f"• **{c['chore_name']}** - Due: {c['due_date_display']} ({c['duration']} min)"
                        for c in user_chores
                    ]
                )

                if not user_chores:
                    return ChatResponse(
                        response="You don't have any pending chores to reassign! 🎉",
                        intent="reassign_chore",
                        proposed_action=None,
                        executed_action=None,
                        conversation_id=conversation_id,
                    )

                return ChatResponse(
                    response=f"I'd be happy to help you reassign a chore! Which one would you like to reassign?\n\n{chores_list}\n\nPlease tell me the name of the chore you want to reassign.",
                    intent="reassign_chore",
                    proposed_action=None,
                    executed_action=None,
                    conversation_id=conversation_id,
                )

            # STEP 2: Get fairness data and find best candidate
            reassignment_analysis = find_best_reassignment_candidate(
                db, ticket_id, current_user.id, current_user.house_id
            )

            if "error" in reassignment_analysis:
                return ChatResponse(
                    response=f"Sorry, I couldn't process the reassignment: {reassignment_analysis['error']}",
                    intent="reassign_chore",
                    proposed_action=None,
                    executed_action=None,
                    conversation_id=conversation_id,
                )

            if not reassignment_analysis.get("candidates"):
                return ChatResponse(
                    response="I couldn't find anyone available to take this chore. All other household members are either busy or unavailable.",
                    intent="reassign_chore",
                    proposed_action=None,
                    executed_action=None,
                    conversation_id=conversation_id,
                )

            best_candidate = reassignment_analysis["candidates"][0]

            # STEP 3: Generate AI reasoning for the recommendation
            reasoning_prompt = f"""
You are ChoreMate AI. Based on the analysis below, explain WHY you recommend reassigning this chore to the suggested person.

Chore Details:
- Name: {reassignment_analysis['chore_name']}
- Duration: {reassignment_analysis['chore_duration']} minutes
- Difficulty: {reassignment_analysis['chore_difficulty']}/5
- Due Date: {reassignment_analysis['due_date_display']}

Best Candidate: {best_candidate['user_name']}
- Current Workload: {best_candidate['current_workload_minutes']} minutes ({best_candidate['current_chore_count']} chores)
- Preference for this chore: {best_candidate['chore_preference']}
- Availability: {best_candidate['availability_note']}
- Suitability Score: {best_candidate['suitability_score']}/1.0

Other Candidates:
{json.dumps(reassignment_analysis['candidates'][1:3], indent=2) if len(reassignment_analysis['candidates']) > 1 else "None"}

Write a concise, friendly explanation (2-3 sentences) for why {best_candidate['user_name']} is the best choice.
"""

            reasoning_response = client.models.generate_content(
                model="gemini-2.0-flash-exp",
                contents=reasoning_prompt,
            )

            ai_reasoning = reasoning_response.text.strip()

            # Create pending action for approval
            action_id = str(uuid.uuid4())
            pending_actions[action_id] = {
                "type": "reassign_chore",
                "ticket_id": ticket_id,
                "requester_id": current_user.id,
                "target_user_id": best_candidate["user_id"],
                "target_user_name": best_candidate["user_name"],
                "reason": reason,
                "reassignment_analysis": reassignment_analysis,
                "house_id": current_user.house_id,
                "created_at": datetime.utcnow().isoformat(),
            }

            # Build response with approval buttons
            proposed_action = ProposedAction(
                action_id=action_id,
                action_type="swap_request",
                title=f"Reassign '{reassignment_analysis['chore_name']}' to {best_candidate['user_name']}",
                description=f"This will reassign the chore to {best_candidate['user_name']}.",
                details={
                    "chore_name": reassignment_analysis["chore_name"],
                    "chore_duration": reassignment_analysis["chore_duration"],
                    "chore_difficulty": reassignment_analysis["chore_difficulty"],
                    "due_date": reassignment_analysis["due_date_display"],
                    "target_user": best_candidate["user_name"],
                    "target_workload": best_candidate["current_workload_minutes"],
                    "target_chore_count": best_candidate["current_chore_count"],
                    "target_preference": best_candidate["chore_preference"],
                    "target_availability": best_candidate["availability_note"],
                    "suitability_score": best_candidate["suitability_score"],
                },
                ai_reasoning=ai_reasoning,
                requires_approval=True,
            )

            # Build alternatives section
            alternatives = ""
            if len(reassignment_analysis["candidates"]) > 1:
                alt_list = reassignment_analysis["candidates"][1:3]
                alternatives = "\n\n**Other options:**\n" + "\n".join(
                    [
                        f"• {c['user_name']} - Workload: {c['current_workload_minutes']}min, {c['availability_note']}, Score: {c['suitability_score']}"
                        for c in alt_list
                    ]
                )

            response_text = f"""I've analyzed your request to reassign **"{reassignment_analysis['chore_name']}"**.

📋 **Chore Details:**
• Duration: {reassignment_analysis['chore_duration']} minutes
• Difficulty: {'⭐' * reassignment_analysis['chore_difficulty']}
• Due: {reassignment_analysis['due_date_display']}

👤 **Recommended: {best_candidate['user_name']}**
• Current workload: {best_candidate['current_workload_minutes']} minutes ({best_candidate['current_chore_count']} chores)
• Preference: {best_candidate['chore_preference']}
• {best_candidate['availability_note']}
• Match score: **{best_candidate['suitability_score']}/1.0**

💡 **Why {best_candidate['user_name']}?**
{ai_reasoning}{alternatives}

Would you like me to reassign this chore to **{best_candidate['user_name']}**?"""

            return ChatResponse(
                response=response_text,
                intent="reassign_chore",
                proposed_action=proposed_action,
                executed_action=None,
                conversation_id=conversation_id,
            )

        # Handle get_my_chores intent
        elif detected_intent == "get_my_chores":
            if not user_chores:
                return ChatResponse(
                    response="You don't have any pending chores! 🎉 Enjoy your free time!",
                    intent="get_my_chores",
                    proposed_action=None,
                    executed_action={"chores_count": 0, "chores": []},
                    conversation_id=conversation_id,
                )

            chores_list = "\n".join(
                [
                    f"• **{c['chore_name']}** - Due: {c['due_date_display']} ({c['duration']} min, Difficulty: {'⭐' * c['difficulty']})"
                    for c in user_chores
                ]
            )

            total_time = sum(c["duration"] for c in user_chores)

            return ChatResponse(
                response=f"Here are your upcoming chores ({len(user_chores)} total, ~{total_time} minutes):\n\n{chores_list}",
                intent="get_my_chores",
                proposed_action=None,
                executed_action={
                    "chores_count": len(user_chores),
                    "chores": user_chores,
                },
                conversation_id=conversation_id,
            )

        # Handle general query
        else:
            general_prompt = f"""
You are ChoreMate AI, a friendly household chore management assistant.

User's chores: {len(user_chores)} pending chores

User query: "{message.message}"

Respond helpfully and conversationally. If they're asking about chores, mention you can help them:
- View their chores
- Reassign chores to roommates
- Check workload fairness

Keep response concise (2-3 sentences).
"""
            general_response = client.models.generate_content(
                model="gemini-2.0-flash-exp",
                contents=general_prompt,
            )

            return ChatResponse(
                response=general_response.text.strip(),
                intent="general_query",
                proposed_action=None,
                executed_action=None,
                conversation_id=conversation_id,
            )

    except Exception as e:
        print(f"Error in chatbot: {str(e)}")
        return ChatResponse(
            response=f"I'm sorry, I encountered an error. Please try again.",
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
    Execute a proposed action after user approval - reassigns the chore
    """
    cleanup_expired_actions()

    action_data = pending_actions.get(approval.action_id)

    if not action_data:
        raise HTTPException(status_code=404, detail="Action not found or expired")

    if action_data["requester_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not approval.approved:
        del pending_actions[approval.action_id]
        return ChatResponse(
            response="No problem! The chore reassignment has been cancelled. Is there anything else I can help you with?",
            intent="reassign_chore",
            proposed_action=None,
            executed_action={"cancelled": True},
            conversation_id=approval.conversation_id,
        )

    # Execute the reassignment
    if action_data["type"] == "reassign_chore":
        ticket = db.query(Ticket).filter(Ticket.id == action_data["ticket_id"]).first()

        if not ticket:
            del pending_actions[approval.action_id]
            raise HTTPException(status_code=404, detail="Ticket no longer exists")

        if ticket.assigned_user_id != current_user.id:
            del pending_actions[approval.action_id]
            raise HTTPException(
                status_code=400, detail="This ticket is no longer assigned to you"
            )

        if ticket.status != "Pending":
            del pending_actions[approval.action_id]
            raise HTTPException(
                status_code=400, detail="This ticket has already been completed"
            )

        # Get chore name for notification
        chore = db.query(Chore).filter(Chore.id == ticket.chore_id).first()
        chore_name = chore.name if chore else "Unknown chore"

        # Reassign the ticket
        old_user_id = ticket.assigned_user_id
        ticket.assigned_user_id = action_data["target_user_id"]

        # Create notification for the new assignee
        notification = Notification(
            user_id=action_data["target_user_id"],
            notification_type="chore_assigned",
            title="New Chore Assigned",
            message=f"{current_user.name} has reassigned '{chore_name}' to you.",
            related_id=ticket.id,
            is_read=0,
        )
        db.add(notification)
        db.commit()

        del pending_actions[approval.action_id]

        return ChatResponse(
            response=f"✅ Done! I've reassigned **'{chore_name}'** to **{action_data['target_user_name']}**. They'll receive a notification about their new chore.\n\nIs there anything else I can help you with?",
            intent="reassign_chore",
            proposed_action=None,
            executed_action={
                "reassigned": True,
                "chore_name": chore_name,
                "new_assignee": action_data["target_user_name"],
                "ticket_id": action_data["ticket_id"],
            },
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
                        "chore_name": action_data.get("reassignment_analysis", {}).get(
                            "chore_name"
                        ),
                        "target_user_id": action_data.get("target_user_id"),
                        "reason": action_data.get("reason"),
                    },
                }
            )

    return {"pending_actions": user_actions, "count": len(user_actions)}
