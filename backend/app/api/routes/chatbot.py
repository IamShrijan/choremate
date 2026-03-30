from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Literal
import json
import uuid
from pydantic import BaseModel, Field

from google import genai
from google.genai import types

from ...models.model import (
    User,
    Ticket,
    Chore,
    UserPreference,
    Notification,
    AIConversation,
)
from ...db.database import get_db
from ..dependencies import get_current_user
from ...core.generate_house_chores import get_gemini_client

router = APIRouter(prefix="/ai-chatbot", tags=["AI Chatbot"])


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================


class ChatMessage(BaseModel):
    message: str = Field(..., description="User's message to the AI chatbot")


class ProposedAction(BaseModel):
    action_id: str
    action_type: str
    title: str
    description: str
    reassignments: List[Dict[str, Any]]  # List of chores to reassign
    ai_reasoning: str


class ChatResponse(BaseModel):
    response: str
    proposed_action: Optional[ProposedAction] = None


class ActionApproval(BaseModel):
    action_id: str
    approved: bool


class ConversationMessage(BaseModel):
    id: str
    created_by: Literal["user", "system"]
    content: str
    created_at: datetime


# ============================================================================
# STRUCTURED OUTPUT SCHEMAS (for Gemini)
# ============================================================================


class ToolParameters(BaseModel):
    """Parameters extracted for tool execution"""

    period_type: str = Field(
        description="The time period type: today, tomorrow, this_weekend, specific_date, date_range"
    )
    start_date: str = Field(description="Start date in YYYY-MM-DD format")
    end_date: str = Field(
        description="End date in YYYY-MM-DD format (only for date_range)"
    )
    reason: str = Field(description="Reason extracted from user message")


class IntentAnalysisResponse(BaseModel):
    """Structured output for intent detection and tool selection"""

    selected_tool: str = Field(
        description="The tool to execute: get_my_chores, reassign_chores_for_period, check_fairness, or general_chat"
    )
    confidence: float = Field(
        ge=0.0, le=1.0, description="Confidence score for the selected tool"
    )
    period_type: str = Field(
        description="The time period type: today, tomorrow, this_weekend, specific_date, date_range, or empty string"
    )
    start_date: str = Field(
        description="Start date in YYYY-MM-DD format or empty string"
    )
    end_date: str = Field(description="End date in YYYY-MM-DD format or empty string")
    reason: str = Field(
        description="Reason extracted from user message or empty string"
    )
    reasoning: str = Field(description="Explanation of why this tool was selected")


class CandidateEvaluation(BaseModel):
    """Evaluation of a single candidate for chore reassignment"""

    user_id: str = Field(description="The user's unique ID")
    user_name: str = Field(description="The user's name")
    suitability_score: float = Field(
        ge=0.0, le=1.0, description="Overall suitability score from 0.0 to 1.0"
    )
    workload_analysis: str = Field(
        description="Analysis of the candidate's current workload"
    )
    preference_analysis: str = Field(
        description="Analysis of the candidate's preferences for this chore"
    )
    availability_analysis: str = Field(
        description="Analysis of the candidate's availability on the due date"
    )
    overall_reasoning: str = Field(
        description="Overall reasoning for why this candidate is suitable or not"
    )


class ChoreReassignmentDecision(BaseModel):
    """LLM's decision on who should be assigned a chore"""

    chore_name: str = Field(description="Name of the chore being reassigned")
    recommended_user_id: str = Field(description="ID of the recommended user")
    recommended_user_name: str = Field(description="Name of the recommended user")
    confidence: float = Field(
        ge=0.0, le=1.0, description="Confidence in this recommendation"
    )
    candidates_evaluated: list[CandidateEvaluation] = Field(
        description="Evaluation of all candidates considered"
    )
    final_reasoning: str = Field(
        description="Final reasoning for the recommendation, considering all factors"
    )


# ============================================================================
# TOOL DEFINITIONS (for LLM to choose from)
# ============================================================================

AVAILABLE_TOOLS = """
TOOL 1: get_my_chores
- Description: Get the current user's pending chores
- Use when: User wants to see their chores or schedule
- Parameters: None

TOOL 2: reassign_chores_for_period
- Description: Reassign user's chores for a specific time period to other household members
- Use when: User says they're busy on a date/period and wants their chores reassigned
- Parameters:
  - period_type: "today" | "tomorrow" | "this_weekend" | "specific_date" | "date_range"
  - start_date: ISO date string (YYYY-MM-DD) - required for specific_date and date_range
  - end_date: ISO date string (YYYY-MM-DD) - only for date_range
  - reason: Why the user wants to reassign (optional)

TOOL 3: check_fairness
- Description: Check workload fairness across household members
- Use when: User asks about fairness, workload distribution, or who has most/least work
- Parameters: None

TOOL 4: general_chat
- Description: General conversation, no specific action needed
- Use when: User is just chatting, asking questions, or the intent is unclear
- Parameters: None
"""


# ============================================================================
# PENDING ACTIONS STORE
# ============================================================================

pending_actions: Dict[str, Dict[str, Any]] = {}
ACTION_EXPIRATION_MINUTES = 30


def cleanup_expired_actions():
    """Remove expired pending actions"""
    now = datetime.utcnow()
    expired = [
        aid
        for aid, data in pending_actions.items()
        if (now - datetime.fromisoformat(data["created_at"])).total_seconds()
        > ACTION_EXPIRATION_MINUTES * 60
    ]
    for aid in expired:
        del pending_actions[aid]


# ============================================================================
# DATABASE HELPER
# ============================================================================


def save_message(db: Session, user_id: str, created_by: str, content: str):
    """Save a message to the AI conversations table"""
    msg = AIConversation(user_id=user_id, created_by=created_by, content=content)
    db.add(msg)
    db.commit()


# ============================================================================
# TOOL IMPLEMENTATIONS
# ============================================================================


def tool_get_my_chores(db: Session, user_id: str, house_id: str) -> Dict[str, Any]:
    """Get all pending chores for the current user"""
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

    chores = [
        {
            "ticket_id": ticket.id,
            "chore_name": chore.name,
            "due_date": ticket.due_date.strftime("%Y-%m-%d")
            if ticket.due_date
            else None,
            "due_date_display": ticket.due_date.strftime("%A, %b %d")
            if ticket.due_date
            else "TBD",
            "duration_minutes": chore.duration,
            "difficulty": chore.difficulty_level,
        }
        for ticket, chore in tickets
    ]

    return {"chores": chores, "total_count": len(chores)}


def tool_get_chores_for_period(
    db: Session, user_id: str, house_id: str, start_date: datetime, end_date: datetime
) -> List[Dict[str, Any]]:
    """Get user's chores within a specific date range"""

    tickets = (
        db.query(Ticket, Chore)
        .join(Chore, Ticket.chore_id == Chore.id)
        .filter(
            Ticket.assigned_user_id == user_id,
            Chore.house_id == house_id,
            Ticket.status == "Pending",
            Ticket.due_date >= start_date,
            Ticket.due_date <= end_date,
        )
        .order_by(Ticket.due_date)
        .all()
    )

    return [
        {
            "ticket_id": ticket.id,
            "chore_name": chore.name,
            "chore_id": chore.id,
            "due_date": ticket.due_date.strftime("%Y-%m-%d"),
            "due_date_display": ticket.due_date.strftime("%A, %b %d"),
            "duration_minutes": chore.duration,
            "difficulty": chore.difficulty_level,
            "notes": chore.notes,
        }
        for ticket, chore in tickets
    ]


def tool_get_fairness_data(db: Session, house_id: str) -> Dict[str, Any]:
    """Get workload fairness data for all household members"""
    now = datetime.utcnow()
    two_weeks = now + timedelta(weeks=2)

    house_users = db.query(User).filter(User.house_id == house_id).all()

    user_workloads = []
    for user in house_users:
        tickets = (
            db.query(Ticket, Chore)
            .join(Chore, Ticket.chore_id == Chore.id)
            .filter(
                Ticket.assigned_user_id == user.id,
                Chore.house_id == house_id,
                Ticket.status == "Pending",
                Ticket.due_date >= now,
                Ticket.due_date <= two_weeks,
            )
            .all()
        )

        total_duration = sum(chore.duration for _, chore in tickets)

        # Get preferences
        pref = (
            db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
        )

        user_workloads.append(
            {
                "user_id": user.id,
                "user_name": user.name,
                "total_minutes": total_duration,
                "chore_count": len(tickets),
                "day_availability": pref.day_availability if pref else [],
                "time_availability": pref.time_availability if pref else [],
                "chore_preferences": pref.chore_preferences if pref else {},
                "special_requirements": pref.special_requirements if pref else "",
            }
        )

    # Sort by workload (lowest first = most available)
    user_workloads.sort(key=lambda x: x["total_minutes"])

    return {"users": user_workloads, "total_users": len(user_workloads)}


def tool_find_best_assignees(
    db: Session,
    house_id: str,
    requester_id: str,
    chores_to_reassign: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Find the best person to reassign each chore to using LLM reasoning"""

    fairness_data = tool_get_fairness_data(db, house_id)
    client = get_gemini_client()

    reassignment_plan = []

    # Track accumulated workload as we assign chores
    accumulated_workload = {
        u["user_id"]: u["total_minutes"] for u in fairness_data["users"]
    }

    for chore in chores_to_reassign:
        # Filter out the requester
        available_candidates = [
            u for u in fairness_data["users"] if u["user_id"] != requester_id
        ]

        if not available_candidates:
            continue

        # Build detailed context for LLM
        candidates_context = []
        for user_data in available_candidates:
            # Check availability on due date
            due_date = datetime.strptime(chore["due_date"], "%Y-%m-%d")
            is_weekend = due_date.weekday() >= 5
            day_type = "weekend" if is_weekend else "weekday"
            is_available_on_day = day_type in user_data["day_availability"]

            # Get chore preference
            chore_pref = user_data["chore_preferences"].get(
                chore["chore_name"], "neutral"
            )

            candidates_context.append(
                {
                    "user_id": user_data["user_id"],
                    "user_name": user_data["user_name"],
                    "current_workload_minutes": accumulated_workload[
                        user_data["user_id"]
                    ],
                    "pending_chore_count": user_data["chore_count"],
                    "chore_preference": chore_pref,
                    "time_availability": user_data["time_availability"],
                    "day_availability": user_data["day_availability"],
                    "is_available_on_due_date": is_available_on_day,
                    "due_date_type": day_type,
                }
            )

        # Build LLM prompt
        llm_prompt = f"""You are an expert household chore assignment coordinator. Your goal is to find the BEST person to take over a chore based on fairness, preferences, and availability.

        CHORE TO REASSIGN:
        - Name: {chore["chore_name"]}
        - Due Date: {chore["due_date_display"]} ({day_type})
        - Duration: {chore["duration_minutes"]} minutes
        - Difficulty: {chore["difficulty"]}/5

        AVAILABLE CANDIDATES:
        {json.dumps(candidates_context, indent=2)}

        EVALUATION CRITERIA:
        1. **Workload Fairness** (40% weight): Lower current workload = better candidate
        2. **Chore Preference** (30% weight): 
        - "dont mind" or "like" = highly suitable
        - "neutral" = moderately suitable
        - "prefer to avoid" = less suitable
        3. **Availability** (30% weight): 
        - Available on the due date type (weekday/weekend) = highly suitable
        - Not available = less suitable but still possible

        INSTRUCTIONS:
        - Evaluate EACH candidate thoroughly
        - Analyze their workload, preferences, and availability
        - Assign a suitability_score (0.0 to 1.0) for each candidate
        - Choose the candidate with the highest overall suitability
        - Be transparent about trade-offs (e.g., someone with lower workload but doesn't like the chore vs someone with higher workload who doesn't mind it)
        - Provide clear reasoning for your final recommendation

        Your recommendation should prioritize fairness while respecting preferences and availability."""

        try:
            # Call Gemini with structured output
            llm_response = client.models.generate_content(
                model="gemini-2.0-flash-exp",
                contents=llm_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ChoreReassignmentDecision.model_json_schema(),
                    thinking_config=types.ThinkingConfig(
                        include_thoughts=True,
                    ),
                ),
            )

            # Parse structured response
            decision = ChoreReassignmentDecision.model_validate_json(llm_response.text)

            # Update accumulated workload
            accumulated_workload[decision.recommended_user_id] += chore[
                "duration_minutes"
            ]

            # Build reassignment plan entry
            # Find the recommended candidate's full details
            recommended_candidate = next(
                (
                    c
                    for c in candidates_context
                    if c["user_id"] == decision.recommended_user_id
                ),
                None,
            )

            if recommended_candidate:
                reassignment_plan.append(
                    {
                        "ticket_id": chore["ticket_id"],
                        "chore_name": chore["chore_name"],
                        "due_date_display": chore["due_date_display"],
                        "duration_minutes": chore["duration_minutes"],
                        "recommended_assignee": {
                            "user_id": decision.recommended_user_id,
                            "user_name": decision.recommended_user_name,
                            "current_workload": recommended_candidate[
                                "current_workload_minutes"
                            ],
                            "chore_preference": recommended_candidate[
                                "chore_preference"
                            ],
                            "is_available": recommended_candidate[
                                "is_available_on_due_date"
                            ],
                            "suitability_score": round(decision.confidence, 2),
                        },
                        "llm_reasoning": {
                            "final_reasoning": decision.final_reasoning,
                            "confidence": decision.confidence,
                            "all_candidates_evaluated": [
                                {
                                    "name": c.user_name,
                                    "score": c.suitability_score,
                                    "workload_analysis": c.workload_analysis,
                                    "preference_analysis": c.preference_analysis,
                                    "availability_analysis": c.availability_analysis,
                                    "reasoning": c.overall_reasoning,
                                }
                                for c in decision.candidates_evaluated
                            ],
                        },
                    }
                )

        except Exception as e:
            print(f"Error in LLM-based assignment for {chore['chore_name']}: {str(e)}")
            import traceback

            traceback.print_exc()
            # Fall back to first available candidate if LLM fails
            if available_candidates:
                fallback = available_candidates[0]
                reassignment_plan.append(
                    {
                        "ticket_id": chore["ticket_id"],
                        "chore_name": chore["chore_name"],
                        "due_date_display": chore["due_date_display"],
                        "duration_minutes": chore["duration_minutes"],
                        "recommended_assignee": {
                            "user_id": fallback["user_id"],
                            "user_name": fallback["user_name"],
                            "current_workload": accumulated_workload[
                                fallback["user_id"]
                            ],
                            "chore_preference": "neutral",
                            "is_available": True,
                            "suitability_score": 0.5,
                        },
                        "llm_reasoning": {
                            "final_reasoning": "Fallback assignment due to LLM error",
                            "confidence": 0.5,
                            "all_candidates_evaluated": [],
                        },
                    }
                )

    return reassignment_plan


def parse_date_period(
    period_type: str, start_date: str = None, end_date: str = None
) -> tuple:
    """Parse the date period into start and end datetime objects"""
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    if period_type == "today":
        return today, today + timedelta(days=1) - timedelta(seconds=1)

    elif period_type == "tomorrow":
        tomorrow = today + timedelta(days=1)
        return tomorrow, tomorrow + timedelta(days=1) - timedelta(seconds=1)

    elif period_type == "this_weekend":
        # Find next Saturday
        days_until_saturday = (5 - today.weekday()) % 7
        if days_until_saturday == 0 and now.weekday() == 5:
            saturday = today  # It's already Saturday
        else:
            saturday = today + timedelta(days=days_until_saturday)
        sunday = saturday + timedelta(days=1)
        return saturday, sunday + timedelta(days=1) - timedelta(seconds=1)

    elif period_type == "specific_date" and start_date:
        date = datetime.strptime(start_date, "%Y-%m-%d")
        return date, date + timedelta(days=1) - timedelta(seconds=1)

    elif period_type == "date_range" and start_date and end_date:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = (
            datetime.strptime(end_date, "%Y-%m-%d")
            + timedelta(days=1)
            - timedelta(seconds=1)
        )
        return start, end

    # Default: next 7 days
    return today, today + timedelta(days=7)


# ============================================================================
# MAIN CHAT ENDPOINT
# ============================================================================


@router.post("/chat", response_model=ChatResponse)
def chat_with_ai(
    message: ChatMessage,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Main chatbot endpoint with tool-based workflow:

    1. First LLM call: Analyze intent → Select tool → Extract parameters
    2. Execute the selected tool
    3. Second LLM call: Generate response from tool results
    4. If action needed: Create proposal for user approval
    """

    # Save user message
    save_message(db, current_user.id, "user", message.message)

    if not current_user.house_id:
        resp = "You need to join a household first to use the AI assistant!"
        save_message(db, current_user.id, "system", resp)
        return ChatResponse(response=resp)

    try:
        client = get_gemini_client()

        # ======================================================================
        # STEP 1: INTENT DETECTION & TOOL SELECTION (Structured Output)
        # ======================================================================

        intent_prompt = f"""
        You are ChoreMate AI. Analyze the user's message and decide which tool to use.

        USER MESSAGE: "{message.message}"

        CURRENT DATE: {datetime.utcnow().strftime("%A, %B %d, %Y")}

        AVAILABLE TOOLS:
        {AVAILABLE_TOOLS}

        INSTRUCTIONS:
        - If user says "busy today", select reassign_chores_for_period with period_type = "today"
        - If user says "busy tomorrow", select reassign_chores_for_period with period_type = "tomorrow"  
        - If user says "busy this weekend" or "Saturday/Sunday", select reassign_chores_for_period with period_type = "this_weekend"
        - If user mentions a specific date, select reassign_chores_for_period with period_type = "specific_date" and start_date
        - If user wants to see their chores, select get_my_chores
        - If user asks about fairness or workload, select check_fairness
        - If unclear or general conversation, select general_chat

        Analyze the intent and extract all relevant parameters.
        """

        intent_response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=intent_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=IntentAnalysisResponse.model_json_schema(),
            ),
        )

        # Parse structured response
        intent_data = IntentAnalysisResponse.model_validate_json(intent_response.text)

        selected_tool = intent_data.selected_tool
        confidence = intent_data.confidence
        reasoning = intent_data.reasoning

        # Access parameters directly (flattened structure)
        period_type = intent_data.period_type or "today"
        start_date_str = intent_data.start_date or None
        end_date_str = intent_data.end_date or None
        reason = intent_data.reason or None

        print(f"[Chatbot] Tool: {selected_tool}, Confidence: {confidence}")

        # ======================================================================
        # STEP 2: EXECUTE THE SELECTED TOOL
        # ======================================================================

        tool_result = None
        proposed_action = None

        if selected_tool == "get_my_chores":
            tool_result = tool_get_my_chores(db, current_user.id, current_user.house_id)

        elif selected_tool == "check_fairness":
            tool_result = tool_get_fairness_data(db, current_user.house_id)

        elif selected_tool == "reassign_chores_for_period":
            # Parse the date period
            start_date, end_date = parse_date_period(
                period_type, start_date_str, end_date_str
            )

            # Get user's chores for that period
            user_chores = tool_get_chores_for_period(
                db, current_user.id, current_user.house_id, start_date, end_date
            )

            if not user_chores:
                tool_result = {
                    "status": "no_chores",
                    "message": f"You don't have any chores scheduled for {period_type.replace('_', ' ')}! 🎉",
                    "period": {
                        "start": start_date.strftime("%Y-%m-%d"),
                        "end": end_date.strftime("%Y-%m-%d"),
                    },
                }
            else:
                # Find best assignees for each chore
                reassignment_plan = tool_find_best_assignees(
                    db, current_user.house_id, current_user.id, user_chores
                )

                if reassignment_plan:
                    # Create pending action for approval
                    action_id = str(uuid.uuid4())
                    pending_actions[action_id] = {
                        "type": "bulk_reassign",
                        "requester_id": current_user.id,
                        "house_id": current_user.house_id,
                        "reassignments": reassignment_plan,
                        "period": period_type,
                        "reason": reason,
                        "created_at": datetime.utcnow().isoformat(),
                    }

                    proposed_action = ProposedAction(
                        action_id=action_id,
                        action_type="bulk_reassign",
                        title=f"Reassign {len(reassignment_plan)} chore(s) for {period_type.replace('_', ' ')}",
                        description=f"The following chores will be reassigned based on AI analysis of workload, preferences, and availability.",
                        reassignments=[
                            {
                                "chore_name": r["chore_name"],
                                "due_date": r["due_date_display"],
                                "duration": f"{r['duration_minutes']} min",
                                "reassign_to": r["recommended_assignee"]["user_name"],
                                "reasoning": r["llm_reasoning"]["final_reasoning"],
                                "confidence": r["llm_reasoning"]["confidence"],
                                "workload": f"{r['recommended_assignee']['current_workload']} min",
                                "preference": r["recommended_assignee"][
                                    "chore_preference"
                                ],
                            }
                            for r in reassignment_plan
                        ],
                        ai_reasoning="Each assignment was evaluated by AI considering workload fairness, personal preferences, and availability. Full reasoning included for each chore.",
                    )

                    tool_result = {
                        "status": "ready_for_approval",
                        "chores_found": len(user_chores),
                        "reassignment_plan": reassignment_plan,
                    }
                else:
                    tool_result = {
                        "status": "no_candidates",
                        "message": "Couldn't find suitable roommates to reassign to.",
                    }

        # ======================================================================
        # STEP 3: GENERATE RESPONSE FROM TOOL RESULTS
        # ======================================================================
        print("tool_result: ", tool_result)

        response_prompt = f"""You are ChoreMate AI. Generate a friendly response based on the tool execution results.

        USER MESSAGE: "{message.message}"

        TOOL USED: {selected_tool}

        TOOL RESULT:
        {json.dumps(tool_result, indent=2) if tool_result else "No specific tool was run."}

        {"PROPOSED ACTION: An action has been created for user approval. Explain what will happen and ask them to confirm." if proposed_action else ""}

        INSTRUCTIONS:
        - Be friendly and concise
        - Use emojis sparingly for warmth 😊
        - If showing chores, format them as a clear list
        - If proposing reassignments, you MUST include the AI reasoning for EACH chore assignment:
          * Show the chore name
          * Show who it will be reassigned to
          * Show the AI's reasoning from the llm_reasoning.final_reasoning field
          * Format it clearly so users understand WHY each person was chosen
        - Be transparent about the decision-making process
        - Mention factors like workload, preferences, and availability
        - If an action needs approval, end with asking the user to confirm (Yes/No buttons will be shown)
        - Keep the response focused and actionable
        
        EXAMPLE FORMAT FOR REASSIGNMENTS:
        "I've analyzed your chores for this weekend and here's my recommendation:
        
        🧹 **[Chore Name]** → [Person Name]
        Why: [AI's reasoning explaining workload, preferences, availability]
        
        🧹 **[Chore Name 2]** → [Person Name 2]
        Why: [AI's reasoning...]
        
        Would you like me to proceed with these reassignments?"
        """

        response_result = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=response_prompt,
        )

        response_text = response_result.text.strip()

        # Save AI response
        save_message(db, current_user.id, "system", response_text)

        return ChatResponse(
            response=response_text,
            proposed_action=proposed_action,
        )

    except Exception as e:
        print(f"Error in chatbot: {str(e)}")
        import traceback

        traceback.print_exc()
        error_resp = "I'm sorry, I encountered an error. Please try again."
        save_message(db, current_user.id, "system", error_resp)
        return ChatResponse(response=error_resp)


# ============================================================================
# APPROVE ACTION ENDPOINT
# ============================================================================


@router.post("/approve-action", response_model=ChatResponse)
def approve_action(
    approval: ActionApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Execute the proposed action after user approval"""
    cleanup_expired_actions()

    action_data = pending_actions.get(approval.action_id)

    if not action_data:
        raise HTTPException(status_code=404, detail="Action not found or expired")

    if action_data["requester_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not approval.approved:
        del pending_actions[approval.action_id]
        resp = "No problem! I've cancelled the reassignment. Let me know if you need anything else! 👍"
        save_message(db, current_user.id, "system", resp)
        return ChatResponse(response=resp)

    # Execute the bulk reassignment
    if action_data["type"] == "bulk_reassign":
        reassigned = []

        for plan in action_data["reassignments"]:
            ticket = db.query(Ticket).filter(Ticket.id == plan["ticket_id"]).first()

            if (
                ticket
                and ticket.assigned_user_id == current_user.id
                and ticket.status == "Pending"
            ):
                new_assignee_id = plan["recommended_assignee"]["user_id"]
                new_assignee_name = plan["recommended_assignee"]["user_name"]

                # Reassign the ticket
                ticket.assigned_user_id = new_assignee_id

                # Create notification for new assignee
                notification = Notification(
                    user_id=new_assignee_id,
                    notification_type="chore_assigned",
                    title="Chore Reassigned to You",
                    message=f"{current_user.name} has reassigned '{plan['chore_name']}' to you (due {plan['due_date_display']}).",
                    related_id=ticket.id,
                    is_read=False,
                )
                db.add(notification)

                reassigned.append(
                    {"chore": plan["chore_name"], "to": new_assignee_name}
                )

        db.commit()
        del pending_actions[approval.action_id]

        # Build response
        if reassigned:
            chore_list = "\n".join(
                [f"• **{r['chore']}** → {r['to']}" for r in reassigned]
            )
            resp = f"✅ Done! I've reassigned {len(reassigned)} chore(s):\n\n{chore_list}\n\nThey've been notified. Enjoy your time off! 🎉"
        else:
            resp = "Hmm, it looks like the chores were already reassigned or completed. No changes were made."

        save_message(db, current_user.id, "system", resp)
        return ChatResponse(response=resp)

    raise HTTPException(status_code=400, detail="Unknown action type")


# ============================================================================
# GET CONVERSATION HISTORY
# ============================================================================


@router.get("/conversations", response_model=List[ConversationMessage])
def get_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 50,
):
    """Load conversation history when opening the chatbot"""
    messages = (
        db.query(AIConversation)
        .filter(AIConversation.user_id == current_user.id)
        .order_by(AIConversation.created_at.asc())
        .limit(limit)
        .all()
    )

    return [
        ConversationMessage(
            id=msg.id,
            created_by=msg.created_by,
            content=msg.content,
            created_at=msg.created_at,
        )
        for msg in messages
    ]


@router.delete("/conversations")
def clear_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear conversation history"""
    db.query(AIConversation).filter(AIConversation.user_id == current_user.id).delete()
    db.commit()
    return {"status": "success", "message": "Conversation cleared"}
