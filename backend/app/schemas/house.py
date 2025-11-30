from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime


# --- House Schemas ---
class HouseInfo(BaseModel):
    id: str
    name: str
    address: Optional[str]
    house_layout: Optional[Dict[str, Any]]
    invite_code: str


class HouseCreate(BaseModel):
    name: str
    address: str
    house_layout: Dict[str, Any]  # e.g. {"bathrooms": 2, "kitchen": 1}
    invited_emails: List[str]  # List of email addresses to invite


class HouseJoin(BaseModel):
    invite_code: str


class HouseInvite(BaseModel):
    emails: List[str]  # List of email addresses to invite
