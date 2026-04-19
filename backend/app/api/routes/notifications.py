import asyncio
import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.model import Notification, User, AppreciationEvent
from app.api.dependencies import get_current_user
from app.core.notifications_bus import publish_notification_sync, sse_listener
from app.core.security import decode_access_token

logger = logging.getLogger(__name__)

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────────────────────────


class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime
    related_id: Optional[str] = None

    class Config:
        orm_mode = True


class AppreciationRequest(BaseModel):
    target_user_id: str
    message: str


# ─────────────────────────────────────────────────────────────────────────────
# SSE auth dependency — accepts token via query param (EventSource can't set headers)
# ─────────────────────────────────────────────────────────────────────────────


def get_current_user_from_token(
    token: str = Query(..., description="JWT access token"),
    db: Session = Depends(get_db),
) -> User:
    """
    Auth dependency for the SSE stream endpoint.
    The browser's EventSource API cannot set custom headers, so the JWT is
    passed as a query parameter instead.
    """
    payload = decode_access_token(token)
    if payload is None or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    user_id = payload["sub"]
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


# ─────────────────────────────────────────────────────────────────────────────
# SSE Stream endpoint
# ─────────────────────────────────────────────────────────────────────────────

SSE_KEEPALIVE_SECONDS = 25  # Send a keepalive comment every N seconds


@router.get("/stream")
async def sse_notifications_stream(
    request: Request,
    current_user: User = Depends(get_current_user_from_token),
):
    """
    Server-Sent Events stream for real-time notifications.

    The client opens this as a persistent GET request:

        const es = new EventSource('/api/notifications/stream?token=<jwt>');
        es.addEventListener('new_notification', () => fetchNotifications());

    The server:
      • Sends `event: connected` immediately to confirm the connection
      • Sends `event: new_notification` whenever a new notification is created
        for this user by any route (appreciation, chatbot reassignment, etc.)
      • Sends a `: keepalive` comment every 25 s to prevent proxy timeouts
      • EventSource auto-reconnects on network drops — no client code needed
    """

    user_id = current_user.id

    async def event_generator():
        # Confirm connection
        yield "event: connected\ndata: {}\n\n"

        async with sse_listener(user_id) as q:
            while True:
                # Check if the client disconnected
                if await request.is_disconnected():
                    logger.debug(f"[SSE] client disconnected for user {user_id}")
                    break

                try:
                    # Wait for a notification signal or timeout for keepalive
                    await asyncio.wait_for(q.get(), timeout=SSE_KEEPALIVE_SECONDS)
                    # A signal arrived — tell the client to refresh
                    yield "event: new_notification\ndata: {}\n\n"
                except asyncio.TimeoutError:
                    # No notification — send keepalive comment to keep connection alive
                    yield ": keepalive\n\n"
                except Exception as exc:
                    logger.warning(f"[SSE] stream error for user {user_id}: {exc}")
                    break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx / ALB response buffering
            "Connection": "keep-alive",
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# Existing REST endpoints (unchanged except appreciation now triggers SSE)
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get all notifications for the current user."""
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return notifications


@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a notification as read."""
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id, Notification.user_id == current_user.id
        )
        .first()
    )

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()

    return {"status": "success", "message": "Notification marked as read"}


@router.delete("/{notification_id}")
def dismiss_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete (dismiss) a notification."""
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id, Notification.user_id == current_user.id
        )
        .first()
    )

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notification)
    db.commit()

    return {"status": "success", "message": "Notification dismissed"}


@router.post("/appreciation")
def send_appreciation(
    request: AppreciationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Send an appreciation message to another user.
    Creates a DB notification AND pushes an SSE signal to the recipient.
    """
    target_user = db.query(User).filter(User.id == request.target_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Persist notification
    notification = Notification(
        user_id=target_user.id,
        notification_type="appreciation",
        title="New Appreciation! 🌟",
        message=f"{current_user.name} sent you an appreciation: {request.message}",
        is_read=False,
        related_id=current_user.id,
    )
    db.add(notification)

    # Persist appreciation event
    appreciation_event = AppreciationEvent(
        sender_id=current_user.id,
        recipient_id=target_user.id,
        message=request.message,
    )
    db.add(appreciation_event)
    db.commit()

    # Push SSE signal to the recipient (fire-and-forget)
    publish_notification_sync(target_user.id)

    return {"status": "success", "message": "Appreciation sent successfully"}
