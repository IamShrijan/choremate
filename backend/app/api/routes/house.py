from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ...schemas.house import HouseCreate, HouseJoin, HouseInvite
from ...models.model import House, User, UserPreference, Ticket  # Add Ticket import
from ..dependencies import get_current_user
from ...db.database import get_db

router = APIRouter(prefix="/house", tags=["House"])


@router.post("/create", response_model=dict)
def create_house(
    house_data: HouseCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    import uuid

    house_id = str(uuid.uuid4())
    invite_code = house_id[:6].upper()

    # Process invited emails - normalize and deduplicate
    invited_emails = []
    if house_data.invited_emails:
        invited_emails = list(
            set(
                [
                    email.lower().strip()
                    for email in house_data.invited_emails
                    if email.strip()
                ]
            )
        )

    new_house = House(
        id=house_id,
        name=house_data.name,
        address=house_data.address,
        house_layout=house_data.house_layout,
        invite_code=invite_code,
        joined_users=[current_user.id],  # Creator is automatically joined
        invited_emails=invited_emails,  # Store invited emails
    )
    db.add(new_house)
    db.commit()
    db.refresh(new_house)

    # Update current user's house_id
    current_user.house_id = house_id
    db.commit()
    db.refresh(current_user)

    # TODO: Send actual email invitations here
    # For now, emails are stored in invited_emails field
    # You can add email sending logic here:
    # for email in invited_emails:
    #     send_invitation_email(email, invite_code, house_data.name)

    return {
        "status": "created",
        "house_id": new_house.id,
        "invite_code": invite_code,
        "house_name": new_house.name,
        "invited_count": len(invited_emails),
    }


@router.get("/members-status")
def get_household_members_status(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get all household members with their preference completion status.
    Returns list of members with their email, name, and whether they've completed preferences.
    Also returns admin status and whether tickets have been generated.
    """
    if not current_user.house_id:
        raise HTTPException(status_code=400, detail="User is not part of any household")

    house = db.query(House).filter(House.id == current_user.house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="Household not found")

    # Determine if current user is admin (first user in joined_users is the creator/admin)
    joined_users = house.joined_users or []
    is_admin = len(joined_users) > 0 and joined_users[0] == current_user.id

    # Check if tickets have been generated (chores are finalized and tickets created)
    # Get all users in the house first
    house_members = db.query(User).filter(User.house_id == house.id).all()
    house_member_ids = [member.id for member in house_members]

    # Count tickets for this house's users
    ticket_count = (
        db.query(Ticket).filter(Ticket.assigned_user_id.in_(house_member_ids)).count()
    )
    tickets_generated = ticket_count > 0

    # Get invited emails that haven't joined yet
    invited_emails = house.invited_emails or []
    joined_emails = [member.email for member in house_members]
    pending_invites = [email for email in invited_emails if email not in joined_emails]

    # Build member status list
    members_status = []

    # Add actual members
    for member in house_members:
        # Check if member has completed preferences
        preferences = (
            db.query(UserPreference).filter(UserPreference.user_id == member.id).first()
        )

        members_status.append(
            {
                "user_id": member.id,
                "name": member.name,
                "email": member.email,
                "has_joined": True,
                "preferences_completed": preferences is not None,
            }
        )

    # Add pending invites (not yet joined)
    for email in pending_invites:
        members_status.append(
            {
                "user_id": None,
                "name": None,
                "email": email,
                "has_joined": False,
                "preferences_completed": False,
            }
        )

    # Count completion status
    total_members = len(house_members)
    completed_count = sum(
        1 for m in members_status if m["has_joined"] and m["preferences_completed"]
    )
    all_completed = total_members > 0 and completed_count == total_members

    return {
        "house_id": house.id,
        "house_name": house.name,
        "invite_code": house.invite_code,
        "members": members_status,
        "total_members": total_members,
        "completed_count": completed_count,
        "all_completed": all_completed,
        "is_admin": is_admin,  # NEW: Admin status
        "tickets_generated": tickets_generated,  # NEW: Ticket status
    }


@router.post("/join")
def join_house(
    join_data: HouseJoin,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # If user is already in a house, don't let them join another
    if current_user.house_id:
        house = db.query(House).filter(House.id == current_user.house_id).first()
        return {
            "status": "already_member",
            "error": "User is already part of a household.",
            "house_name": house.name,
            "house_id": house.id,
        }

    house = db.query(House).filter(House.invite_code == join_data.invite_code).first()
    if not house:
        raise HTTPException(status_code=404, detail="Invalid Invite Code")

    current_user.house_id = house.id

    # Add user to joined_users list
    joined_users = house.joined_users or []
    if current_user.id not in joined_users:
        joined_users.append(current_user.id)
        house.joined_users = joined_users

    db.commit()
    db.refresh(current_user)

    return {"status": "joined", "house_name": house.name, "house_id": house.id}
