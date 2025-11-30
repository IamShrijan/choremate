from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime


class ChatMessage(BaseModel):
    message: str = Field(..., description="User's message to the AI chatbot")
    conversation_id: Optional[str] = Field(
        None, description="ID to track multi-turn conversations"
    )


# Structured output for AI's intent analysis
class AIIntentAnalysis(BaseModel):
    """Structured output from Gemini for intent classification"""

    intent: Literal[
        "request_swap",
        "get_my_chores",
        "get_fairness_report",
        "general_query",
        "approve_action",
        "reject_action",
    ] = Field(description="The detected intent/tool to use")
    confidence: float = Field(description="Confidence score 0-1", ge=0, le=1)
    parameters: Dict[str, Any] = Field(
        default_factory=dict, description="Extracted parameters"
    )
    reasoning: str = Field(description="AI's reasoning for this classification")
    user_message: str = Field(description="Friendly message to show the user")


# Proposed action that needs user approval
class ProposedAction(BaseModel):
    action_id: str = Field(description="Unique ID for this proposed action")
    action_type: Literal[
        "swap_request", "chore_query", "fairness_query", "general_response"
    ]
    title: str = Field(description="Short title of the proposed action")
    description: str = Field(description="Detailed description of what will happen")
    details: Dict[str, Any] = Field(description="Action-specific details")
    ai_reasoning: str = Field(description="Why the AI recommends this action")
    requires_approval: bool = Field(
        description="Whether this needs user approval before execution"
    )


class ChatResponse(BaseModel):
    response: str = Field(..., description="AI's text response to the user")
    intent: Optional[str] = Field(None, description="Detected intent")
    proposed_action: Optional[ProposedAction] = Field(
        None, description="Action proposed by AI awaiting approval"
    )
    executed_action: Optional[Dict[str, Any]] = Field(
        None, description="Details of executed action (after approval)"
    )
    conversation_id: str = Field(description="ID to track this conversation")


class ActionApproval(BaseModel):
    action_id: str = Field(description="ID of the action to approve/reject")
    approved: bool = Field(description="Whether the user approves the action")
    conversation_id: str = Field(description="Conversation ID for context")


class SwapRequestCreate(BaseModel):
    ticket_id: str
    reason: Optional[str] = None


class SwapRequestResponse(BaseModel):
    swap_request_id: str
    status: str
    target_user_name: str
    message: str


class NotificationResponse(BaseModel):
    id: str
    notification_type: str
    title: str
    message: str
    related_id: Optional[str]
    is_read: bool
    created_at: datetime
