from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.db.database import get_db
from app.models.model import Notification, User
from app.api.dependencies import get_current_user

router = APIRouter()


# Pydantic schemas
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

    # Convert SQLite integer boolean to Python boolean for response
    for note in notifications:
        note.is_read = bool(note.is_read)

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

    notification.is_read = 1
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
    """Send an appreciation message to another user."""
    # Verify target user exists
    target_user = db.query(User).filter(User.id == request.target_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Create notification for target user
    notification = Notification(
        user_id=target_user.id,
        notification_type="appreciation",
        title="New Appreciation! 🌟",
        message=f"{current_user.name} sent you an appreciation: {request.message}",
        is_read=0,
        related_id=current_user.id,  # Link to sender
    )

    db.add(notification)

    # Also create a permanent AppreciationEvent record
    from app.models.model import AppreciationEvent

    appreciation_event = AppreciationEvent(
        sender_id=current_user.id,
        recipient_id=target_user.id,
        message=request.message,
    )
    db.add(appreciation_event)

    db.commit()

    return {"status": "success", "message": "Appreciation sent successfully"}
