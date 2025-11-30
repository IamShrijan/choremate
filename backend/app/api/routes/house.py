from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...schemas.house import HouseCreate, HouseJoin
from ...models.model import House
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
    invite_code = house_id[:6]

    new_house = House(
        id=house_id,
        name=house_data.name,
        address=house_data.address,
        house_layout=house_data.house_layout,
        invite_code=invite_code,
    )
    db.add(new_house)
    db.commit()
    db.refresh(new_house)

    # Update current user's house_id
    current_user.house_id = house_id
    db.commit()
    db.refresh(current_user)

    return {"status": "created", "house_id": new_house.id, "invite_code": invite_code}


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
    db.commit()
    db.refresh(current_user)

    return {"status": "joined", "house_name": house.name, "house_id": house.id}
