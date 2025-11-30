from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...schemas.user_preferences import UserPreferencesUpdate
from ...models.model import UserPreference, User
from ..dependencies import get_current_user
from ...db.database import get_db

router = APIRouter(prefix="/preferences", tags=["Preferences"])


@router.post("/update", response_model=dict)
def update_user_preferences(
    preferences: UserPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create or update user preferences after survey completion.
    This is called after a user joins a household or creates a new one.
    """
    # Validate cleanliness level is within range
    if not (1 <= preferences.cleanliness_level <= 5):
        raise HTTPException(
            status_code=400, detail="Cleanliness level must be between 1 and 5"
        )

    # Check if user preferences already exist
    existing_preferences = (
        db.query(UserPreference)
        .filter(UserPreference.user_id == current_user.id)
        .first()
    )

    if existing_preferences:
        # Update existing preferences
        existing_preferences.cleanliness_level = preferences.cleanliness_level
        existing_preferences.time_availability = preferences.time_availability
        existing_preferences.day_availability = preferences.day_availability
        existing_preferences.chore_preferences = preferences.chore_preferences
        existing_preferences.special_requirements = preferences.special_requirements

        db.commit()
        db.refresh(existing_preferences)

        return {
            "status": "updated",
            "message": "User preferences updated successfully",
            "preferences_id": existing_preferences.id,
        }
    else:
        # Create new preferences
        new_preferences = UserPreference(
            cleanliness_level=preferences.cleanliness_level,
            time_availability=preferences.time_availability,
            day_availability=preferences.day_availability,
            chore_preferences=preferences.chore_preferences,
            special_requirements=preferences.special_requirements,
            user_id=current_user.id,
        )

        db.add(new_preferences)
        db.commit()
        db.refresh(new_preferences)

        return {
            "status": "created",
            "message": "User preferences created successfully",
            "preferences_id": new_preferences.id,
        }


@router.get("/my-preferences", response_model=dict)
def get_my_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the current user's preferences.
    """
    preferences = (
        db.query(UserPreference)
        .filter(UserPreference.user_id == current_user.id)
        .first()
    )

    if not preferences:
        raise HTTPException(
            status_code=404, detail="No preferences found for this user"
        )

    return {
        "cleanliness_level": preferences.cleanliness_level,
        "time_availability": preferences.time_availability,
        "day_availability": preferences.day_availability,
        "chore_preferences": preferences.chore_preferences,
        "special_requirements": preferences.special_requirements,
    }
