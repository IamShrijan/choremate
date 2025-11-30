from pydantic import BaseModel
from typing import Optional, Dict, Any, Literal
from datetime import datetime


# --- House Schemas ---
class HouseCreate(BaseModel):
    name: str
    address: str
    house_layout: Dict[str, Any]  # e.g. {"bathrooms": 2, "kitchen": 1}


class HouseJoin(BaseModel):
    invite_code: str
