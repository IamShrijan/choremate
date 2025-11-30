from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


# --- User Schemas ---
class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


# --- House Schemas ---
class HouseCreate(BaseModel):
    name: str
    address: str
    house_layout: Dict[str, Any]  # e.g. {"bathrooms": 2, "kitchen": 1}


class HouseJoin(BaseModel):
    invite_code: str


# --- Chore & Ticket Schemas ---
class ChoreCreate(BaseModel):
    name: str
    description: Optional[str] = None
    difficulty_level: int  # 1-5
    chore_frequency: str  # "Weekly", "Daily"


class TicketUpdate(BaseModel):
    status: str  # "Completed", "Pending"
