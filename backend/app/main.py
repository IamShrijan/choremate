from fastapi import FastAPI, Depends, HTTPException, status, APIRouter
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List
import models, schemas  # Assuming previous models are in models.py
from database import get_db  # Your DB session dependency

app = FastAPI(title="Roommate Chore Platform")


# --- Dependencies ---
def get_current_user(token: str, db: Session = Depends(get_db)):
    # simplified mock for demo purposes
    # in prod, decode JWT token here
    user = db.query(models.User).first()
    return user


# ==========================================
# 🏠 ROUTER 1: HOUSE MANAGEMENT
# ==========================================
house_router = APIRouter(prefix="/house", tags=["House"])


@house_router.post("/create", response_model=dict)
def create_house(
    house_data: schemas.HouseCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # 1. Generate unique invite code
    import uuid

    invite_code = str(uuid.uuid4())[:8]

    # 2. Create House
    new_house = models.House(
        name=house_data.name,
        address=house_data.address,
        house_layout=house_data.house_layout,
        invite_code=invite_code,
    )
    db.add(new_house)
    db.commit()
    db.refresh(new_house)

    # 3. Assign Creator to House
    current_user.house_id = new_house.id
    db.commit()

    return {"status": "created", "house_id": new_house.id, "invite_code": invite_code}


@house_router.post("/join")
def join_house(
    join_data: schemas.HouseJoin,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    house = (
        db.query(models.House)
        .filter(models.House.invite_code == join_data.invite_code)
        .first()
    )
    if not house:
        raise HTTPException(status_code=404, detail="Invalid Invite Code")

    current_user.house_id = house.id
    db.commit()
    return {"status": "joined", "house_name": house.name}


# ==========================================
# 🧹 ROUTER 2: CHORES & TICKETS
# ==========================================
chore_router = APIRouter(prefix="/chores", tags=["Chores"])


@chore_router.post("/add")
def add_chore(
    chore: schemas.ChoreCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.house_id:
        raise HTTPException(status_code=400, detail="You must belong to a house first.")

    new_chore = models.Chore(**chore.dict(), house_id=current_user.house_id)
    db.add(new_chore)
    db.commit()
    return {"status": "chore added", "chore_id": new_chore.id}


@chore_router.post("/generate-monthly-batch")
def generate_tickets(
    month: int,
    year: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Triggers the Batch Logic we designed earlier.
    In production, this is usually called by a cron job (system timer), not a user button.
    """
    from logic import (
        generate_monthly_tickets,
    )  # Importing the function from previous turn

    result = generate_monthly_tickets(db, current_user.house_id, year, month)
    return result


@chore_router.patch("/ticket/{ticket_id}")
def update_ticket_status(
    ticket_id: int, update: schemas.TicketUpdate, db: Session = Depends(get_db)
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.status = update.status
    if update.status == "Completed":
        from datetime import datetime

        ticket.completed_at = datetime.now()

    db.commit()
    return {"status": "updated", "new_state": ticket.status}


@chore_router.get("/my-tickets")
def get_my_tickets(
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    tickets = (
        db.query(models.Ticket)
        .filter(
            models.Ticket.assigned_user_id == current_user.id,
            models.Ticket.status != "Completed",  # Only show pending
        )
        .all()
    )
    return tickets


# ==========================================
# 🏆 ROUTER 3: GAMIFICATION & LEADERBOARD
# ==========================================
game_router = APIRouter(prefix="/stats", tags=["Gamification"])


@game_router.get("/leaderboard")
def get_leaderboard(
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    """
    Calculates points based on completed chores difficulty level.
    """
    # SQL Aggregation: Sum of difficulty_level for all COMPLETED tickets per user
    results = (
        db.query(
            models.User.name,
            func.count(models.Ticket.id).label("tasks_done"),
            func.sum(models.Chore.difficulty_level).label("points"),
        )
        .join(models.Ticket, models.Ticket.assigned_user_id == models.User.id)
        .join(models.Chore, models.Ticket.chore_id == models.Chore.id)
        .filter(models.Ticket.status == "Completed")
        .filter(models.User.house_id == current_user.house_id)
        .group_by(models.User.id)
        .order_by(desc("points"))
        .all()
    )

    # Format for JSON response
    leaderboard = [{"user": r[0], "tasks": r[1], "points": r[2] or 0} for r in results]

    return leaderboard


@game_router.post("/appreciate/{ticket_id}")
def send_appreciation(
    ticket_id: int,
    message: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()

    # Validation: Can't appreciate yourself
    if ticket.assigned_user_id == current_user.id:
        raise HTTPException(
            status_code=400, detail="Nice try, but you can't appreciate yourself!"
        )

    appreciation = models.Appreciation(
        ticket_id=ticket_id, appreciated_by=current_user.id, message=message
    )
    db.add(appreciation)
    db.commit()
    return {"status": "Appreciation sent!"}


# --- Register Routers ---
app.include_router(house_router)
app.include_router(chore_router)
app.include_router(game_router)
