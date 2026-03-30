import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.sql import func
from sqlalchemy.types import TypeDecorator, CHAR

from ..db.database import Base


# ---------------------------------------------------------------------------
# Portable UUID column type
# Uses native UUID on PostgreSQL, CHAR(36) on SQLite — transparent to app code.
# ---------------------------------------------------------------------------
class UUID(TypeDecorator):
    """Platform-independent UUID type.
    Stores as native UUID on PostgreSQL, CHAR(36) on SQLite.
    Values always returned as plain strings.
    """
    impl = CHAR(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=False))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return str(value)


def new_uuid() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class House(Base):
    __tablename__ = "houses"

    id             = Column(UUID(), primary_key=True, index=True, default=new_uuid)
    name           = Column(String(255), nullable=False)
    address        = Column(String(500), nullable=True)
    house_layout   = Column(JSON, nullable=True)
    invite_code    = Column(String(64), unique=True, index=True, nullable=True)
    joined_users   = Column(JSON, nullable=True, default=list)
    invited_emails = Column(JSON, nullable=True, default=list)


class User(Base):
    __tablename__ = "users"

    id           = Column(UUID(), primary_key=True, index=True, default=new_uuid)
    name         = Column(String(255), nullable=False)
    email        = Column(String(255), unique=True, index=True, nullable=False)
    password     = Column(String(255), nullable=False)
    user_profile = Column(JSON, nullable=True)
    house_id     = Column(UUID(), ForeignKey("houses.id"), nullable=True)


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id                   = Column(UUID(), primary_key=True, index=True, default=new_uuid)
    cleanliness_level    = Column(Integer, nullable=True)
    time_availability    = Column(JSON, nullable=True)   # ["morning", "afternoon", ...]
    day_availability     = Column(JSON, nullable=True)   # ["weekday", "weekend"]
    special_requirements = Column(Text, nullable=True)
    chore_preferences    = Column(JSON, nullable=True)   # {"Cleaning": "like", ...}
    user_id              = Column(UUID(), ForeignKey("users.id"), nullable=False)


class Chore(Base):
    __tablename__ = "chores"

    id               = Column(UUID(), primary_key=True, index=True, default=new_uuid)
    name             = Column(String(255), nullable=False)
    description      = Column(Text, nullable=True)
    difficulty_level = Column(Integer, nullable=True)    # 1-5
    duration         = Column(Integer, nullable=True)    # minutes
    chore_frequency  = Column(String(64), nullable=True) # "Daily", "Weekly", "Monthly"
    chore_priority   = Column(Integer, nullable=True)    # 1-3
    notes            = Column(Text, nullable=True)
    icon             = Column(String(16), nullable=True) # emoji
    house_id         = Column(UUID(), ForeignKey("houses.id"), nullable=False)


class Ticket(Base):
    __tablename__ = "tickets"

    id               = Column(UUID(), primary_key=True, index=True, default=new_uuid)
    chore_id         = Column(UUID(), ForeignKey("chores.id"), nullable=False)
    assigned_user_id = Column(UUID(), ForeignKey("users.id"), nullable=False)
    created_user_id  = Column(UUID(), ForeignKey("users.id"), nullable=True)
    status           = Column(String(64), nullable=False, default="Pending")
    due_date         = Column(DateTime, nullable=True)
    created_at       = Column(DateTime, nullable=False, server_default=func.now())
    updated_at       = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    completed_at     = Column(DateTime, nullable=True)


class Appreciation(Base):
    __tablename__ = "appreciations"

    id             = Column(UUID(), primary_key=True, index=True, default=new_uuid)
    ticket_id      = Column(UUID(), ForeignKey("tickets.id"), nullable=False)
    appreciated_by = Column(UUID(), ForeignKey("users.id"), nullable=False)
    message        = Column(Text, nullable=True)
    created_at     = Column(DateTime, nullable=False, server_default=func.now())


class SwapRequest(Base):
    __tablename__ = "swap_requests"

    id                = Column(UUID(), primary_key=True, index=True, default=new_uuid)
    ticket_id         = Column(UUID(), ForeignKey("tickets.id"), nullable=False)
    requester_user_id = Column(UUID(), ForeignKey("users.id"), nullable=False)
    target_user_id    = Column(UUID(), ForeignKey("users.id"), nullable=False)
    reason            = Column(Text, nullable=True)
    status            = Column(String(64), nullable=False, default="Pending")
    ai_analysis       = Column(JSON, nullable=True)
    created_at        = Column(DateTime, nullable=False, server_default=func.now())
    responded_at      = Column(DateTime, nullable=True)


class Notification(Base):
    __tablename__ = "notifications"

    id                = Column(UUID(), primary_key=True, index=True, default=new_uuid)
    user_id           = Column(UUID(), ForeignKey("users.id"), nullable=False)
    notification_type = Column(String(64), nullable=False)
    title             = Column(String(255), nullable=False)
    message           = Column(Text, nullable=True)
    related_id        = Column(UUID(), nullable=True)
    # Fixed: was Integer(0/1) — SQLite hack. PostgreSQL has native Boolean.
    is_read           = Column(Boolean, nullable=False, default=False)
    created_at        = Column(DateTime, nullable=False, server_default=func.now())


class AppreciationEvent(Base):
    __tablename__ = "appreciation_events"

    id           = Column(UUID(), primary_key=True, index=True, default=new_uuid)
    sender_id    = Column(UUID(), ForeignKey("users.id"), nullable=False)
    recipient_id = Column(UUID(), ForeignKey("users.id"), nullable=False)
    message      = Column(Text, nullable=True)
    created_at   = Column(DateTime, nullable=False, server_default=func.now())


class Feedback(Base):
    __tablename__ = "feedback"

    id         = Column(UUID(), primary_key=True, index=True, default=new_uuid)
    user_id    = Column(UUID(), ForeignKey("users.id"), nullable=False)
    message    = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class AIConversation(Base):
    """Stores all AI chatbot conversation messages for each user"""
    __tablename__ = "ai_conversations"

    id         = Column(UUID(), primary_key=True, index=True, default=new_uuid)
    user_id    = Column(UUID(), ForeignKey("users.id"), nullable=False)
    created_by = Column(String(16), nullable=False)   # "user" or "system"
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
