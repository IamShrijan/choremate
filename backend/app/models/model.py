import uuid

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func

from ..db.database import Base


# Use 36-char string UUIDs (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
UUIDStr = String(36)


class House(Base):
    __tablename__ = "houses"

    id = Column(
        UUIDStr, primary_key=True, index=True, default=lambda: str(uuid.uuid4())
    )
    name = Column(String)
    address = Column(String)
    house_layout = Column(JSON)  # stored as JSON
    invite_code = Column(String, unique=True, index=True)
    joined_users = Column(JSON, default=lambda: [])  # list of user IDs
    invited_emails = Column(JSON, default=lambda: [])  # list of invited email addresses


class User(Base):
    __tablename__ = "users"

    id = Column(
        UUIDStr, primary_key=True, index=True, default=lambda: str(uuid.uuid4())
    )
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    user_profile = Column(JSON)  # JSON
    house_id = Column(UUIDStr, ForeignKey("houses.id"))


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(
        UUIDStr, primary_key=True, index=True, default=lambda: str(uuid.uuid4())
    )
    cleanliness_level = Column(Integer)
    time_availability = Column(
        JSON
    )  # e.g. ["morning", "afternoon", "evening", "night"]
    day_availability = Column(JSON)  # e.g. ["weekday", "weekend"]
    special_requirements = Column(String)
    chore_preferences = Column(JSON)  # e.g. ["Cleaning", "Repair"]
    user_id = Column(UUIDStr, ForeignKey("users.id"))


class Chore(Base):
    __tablename__ = "chores"

    id = Column(
        UUIDStr, primary_key=True, index=True, default=lambda: str(uuid.uuid4())
    )
    name = Column(String)
    description = Column(String)
    difficulty_level = Column(Integer)  # 1-5
    duration = Column(Integer)  # in minutes
    chore_frequency = Column(String)  # "Daily", "Weekly", "Monthly", "One-time"
    chore_priority = Column(Integer)  # 1-3 low medium high
    notes = Column(String)
    icon = Column(String, nullable=True)  # NEW: emoji / icon name
    house_id = Column(UUIDStr, ForeignKey("houses.id"))


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(
        UUIDStr, primary_key=True, index=True, default=lambda: str(uuid.uuid4())
    )
    chore_id = Column(UUIDStr, ForeignKey("chores.id"))
    assigned_user_id = Column(UUIDStr, ForeignKey("users.id"))
    created_user_id = Column(UUIDStr, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="Pending")
    due_date = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime, nullable=True)


class Appreciation(Base):
    __tablename__ = "appreciations"

    id = Column(
        UUIDStr, primary_key=True, index=True, default=lambda: str(uuid.uuid4())
    )
    ticket_id = Column(UUIDStr, ForeignKey("tickets.id"))
    appreciated_by = Column(UUIDStr, ForeignKey("users.id"))
    message = Column(String)
    created_at = Column(DateTime, server_default=func.now())


class SwapRequest(Base):
    __tablename__ = "swap_requests"

    id = Column(
        UUIDStr, primary_key=True, index=True, default=lambda: str(uuid.uuid4())
    )
    ticket_id = Column(UUIDStr, ForeignKey("tickets.id"))
    requester_user_id = Column(UUIDStr, ForeignKey("users.id"))
    target_user_id = Column(UUIDStr, ForeignKey("users.id"))
    reason = Column(String, nullable=True)
    status = Column(String, default="Pending")  # Pending, Accepted, Rejected
    ai_analysis = Column(JSON, nullable=True)  # Store AI's reasoning
    created_at = Column(DateTime, server_default=func.now())
    responded_at = Column(DateTime, nullable=True)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(
        UUIDStr, primary_key=True, index=True, default=lambda: str(uuid.uuid4())
    )
    user_id = Column(UUIDStr, ForeignKey("users.id"))
    notification_type = Column(
        String
    )  # swap_request, swap_accepted, swap_rejected, etc.
    title = Column(String)
    message = Column(String)
    related_id = Column(
        UUIDStr, nullable=True
    )  # Reference to swap_request, ticket, etc.
    is_read = Column(Integer, default=0)  # SQLite uses 0/1 for boolean
    created_at = Column(DateTime, server_default=func.now())
