from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    DateTime,
    JSON,
    TIMESTAMP,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base  # Assuming standard setup


class House(Base):
    __tablename__ = "houses"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    address = Column(String)
    # Storing layout flexible data like bathroom_count here
    house_layout = Column(JSON)
    invite_code = Column(String, unique=True)  # Added for "Join House" logic


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)  # Hashed
    house_id = Column(Integer, ForeignKey("houses.id"))
    user_profile = Column(JSON)  # e.g. {"avatar": "url", "nickname": "Dave"}

    preferences = relationship("UserPreference", back_populates="user", uselist=False)


class UserPreference(Base):
    __tablename__ = "user_preferences"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    cleanliness_level = Column(Integer)
    day_availability = Column(String)  # "Weekday", "Weekend"
    special_requirements = Column(String)  # "No heavy lifting"
    user = relationship("User", back_populates="preferences")


class Chore(Base):
    __tablename__ = "chores"
    id = Column(Integer, primary_key=True)
    house_id = Column(Integer, ForeignKey("houses.id"))
    name = Column(String)
    difficulty_level = Column(Integer)
    chore_frequency = Column(String)  # "Weekly", "Daily"


class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True)
    chore_id = Column(Integer, ForeignKey("chores.id"))
    assigned_user_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="Pending")
    due_date = Column(DateTime)
    completed_at = Column(DateTime, nullable=True)
