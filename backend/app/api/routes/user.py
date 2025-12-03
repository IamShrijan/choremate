from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ...schemas.user import UserProfileResponse, UserPreferencesInfo
from ...schemas.house import HouseInfo
from ...models.model import User, House, UserPreference, Ticket
from ..dependencies import get_current_user
from ...db.database import get_db

router = APIRouter(prefix="/user", tags=["User"])


@router.get("/me", response_model=dict)
def get_current_user_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get basic current user information (simpler endpoint).
    """
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "user_profile": current_user.user_profile,
        "house_id": current_user.house_id,
    }


@router.get("/profile", response_model=UserProfileResponse)
def get_user_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get comprehensive user profile including:
    - User basic information
    - House information (if user belongs to a house)
    - User preferences (if set)
    - Ticket statistics
    """
    # Fetch house information if user belongs to a house
    house_info = None
    if current_user.house_id:
        house = db.query(House).filter(House.id == current_user.house_id).first()
        if house:
            house_info = HouseInfo(
                id=house.id,
                name=house.name,
                address=house.address,
                house_layout=house.house_layout,
                invite_code=house.invite_code,
            )

    # Fetch user preferences
    preferences_info = None
    preferences = (
        db.query(UserPreference)
        .filter(UserPreference.user_id == current_user.id)
        .first()
    )

    if preferences:
        preferences_info = UserPreferencesInfo(
            cleanliness_level=preferences.cleanliness_level,
            time_availability=preferences.time_availability,
            day_availability=preferences.day_availability,
            chore_preferences=preferences.chore_preferences,
            special_requirements=preferences.special_requirements,
        )

    # Count tickets
    total_tickets = (
        db.query(func.count(Ticket.id))
        .filter(Ticket.assigned_user_id == current_user.id)
        .scalar()
        or 0
    )

    completed_tickets = (
        db.query(func.count(Ticket.id))
        .filter(
            Ticket.assigned_user_id == current_user.id, Ticket.status == "Completed"
        )
        .scalar()
        or 0
    )

    pending_tickets = (
        db.query(func.count(Ticket.id))
        .filter(Ticket.assigned_user_id == current_user.id, Ticket.status == "Pending")
        .scalar()
        or 0
    )

    ticket_stats = {
        "total": total_tickets,
        "completed": completed_tickets,
        "pending": pending_tickets,
    }

    # Build response
    return UserProfileResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        user_profile=current_user.user_profile,
        house=house_info,
        preferences=preferences_info,
        ticket_stats=ticket_stats,
    )


@router.get("/fetch-roommates")
def fetch_roommates(
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    """
    Fetch all users (roommates) in the current user's house.
    Returns a list of users with their basic information.
    """
    if not current_user.house_id:
        raise HTTPException(
            status_code=400, detail="You must belong to a house to view roommates."
        )

    # Query all users in the same house
    roommates = db.query(User).filter(User.house_id == current_user.house_id).all()

    # Format the response
    result = []
    for roommate in roommates:
        result.append(
            {
                "id": roommate.id,
                "name": roommate.name,
                "email": roommate.email,
                "is_current_user": roommate.id == current_user.id,
            }
        )

    return result
