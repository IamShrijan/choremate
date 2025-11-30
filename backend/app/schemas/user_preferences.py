from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Literal, List
from datetime import datetime
from ..core.default_chores import get_default_chores


def get_default_chore_preferences() -> (
    Dict[str, Literal["dont mind", "neutral", "prefer to avoid"]]
):
    """Generate default chore preferences with all chores set to neutral."""
    chores = get_default_chores()
    return {chore["name"]: "neutral" for chore in chores}


# --- User Preferences Schemas ---
class UserPreferencesUpdate(BaseModel):
    cleanliness_level: int  # 1-5 (mapped from frontend: Presentable=1, Livable=2, Tidy=3, Clean=4, Spotless=5)
    time_availability: List[
        Literal["morning", "afternoon", "evening", "night"]
    ]  # Multiple selections allowed
    day_availability: List[Literal["weekday", "weekend"]]  # Multiple selections allowed
    chore_preferences: Dict[
        str, Literal["dont mind", "neutral", "prefer to avoid"]
    ] = Field(
        default_factory=get_default_chore_preferences
    )  # JSON: {"chore_name": "preference"}
    special_requirements: Optional[str] = None  # Free text from Step 4

    model_config = {
        "json_schema_extra": {
            "example": {
                "cleanliness_level": 3,
                "time_availability": ["morning", "evening"],
                "day_availability": ["weekday"],
                "chore_preferences": get_default_chore_preferences(),
                "special_requirements": "I have allergies to strong cleaning products",
            }
        }
    }
