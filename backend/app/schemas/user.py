from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime
from .house import HouseInfo


# --- User Schemas (placeholders, adjust as needed) ---
class UserCreate(BaseModel):
    name: str
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


# --- User Profile Response Schemas ---
class UserPreferencesInfo(BaseModel):
    cleanliness_level: Optional[int]
    time_availability: Optional[
        List[Literal["morning", "afternoon", "evening", "night"]]
    ]
    day_availability: Optional[List[Literal["weekday", "weekend"]]]
    chore_preferences: Optional[Dict[str, str]]
    special_requirements: Optional[str]


class UserProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    user_profile: Optional[Dict[str, Any]]
    house: Optional[HouseInfo] = None
    preferences: Optional[UserPreferencesInfo] = None
    ticket_stats: Optional[Dict[str, int]] = None
