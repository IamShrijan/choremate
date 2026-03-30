from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...schemas.chore_and_ticket import ChoreCreate, TicketUpdate
from ...models.model import Chore, Ticket
from ...core.generate_monthly_tickets import generate_monthly_tickets
from ...core.generate_house_chores import generate_house_chores
from ..dependencies import get_current_user
from ...db.database import get_db
from ...models.model import User
from ...schemas.chore_and_ticket import TicketWithChoreDetails


router = APIRouter(prefix="/chores", tags=["Chores"])


@router.post("/add")
def add_chore(
    chore: ChoreCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.house_id:
        raise HTTPException(status_code=400, detail="You must belong to a house first.")

    new_chore = Chore(
        name=chore.name,
        description=chore.description,
        difficulty_level=chore.difficulty_level,
        chore_frequency=chore.chore_frequency,
        chore_priority=chore.chore_priority,
        duration=chore.duration,
        notes=chore.notes,
        icon=chore.icon,
        house_id=current_user.house_id,
    )

    db.add(new_chore)
    db.commit()
    db.refresh(new_chore)
    return {"status": "chore added", "chore_id": new_chore.id}


@router.post("/add-chores")
def add_chores(
    chores: List[ChoreCreate],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Add multiple chores at once.
    """
    if not current_user.house_id:
        raise HTTPException(status_code=400, detail="You must belong to a house first.")

    created_chores = []
    for chore in chores:
        new_chore = Chore(
            name=chore.name,
            description=chore.description,
            difficulty_level=chore.difficulty_level,
            chore_frequency=chore.chore_frequency,
            chore_priority=chore.chore_priority,
            duration=chore.duration,
            notes=chore.notes,
            icon=chore.icon,
            house_id=current_user.house_id,
        )
        db.add(new_chore)
        created_chores.append(new_chore)

    # Commit the changes to the database
    db.commit()

    # Refresh the created chores
    for chore in created_chores:
        db.refresh(chore)

    return {
        "status": "chores added to db",
        "chores_count": len(created_chores),
    }


@router.post("/generate-house-chores")
def generate_house_chores_for_users(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Generate chores for the current user's house using Gemini AI.
    Chores are assigned to users and returned grouped by user_id.

    Response format:
    {
        "chores_by_user": {
            "user_id_1": {
                "user_name": "...",
                "chores": [...],
                "weekly_score": ...,
                "chore_count": ...
            },
            "user_id_2": { ... }
        },
        "fairness_summary": { ... }
    }
    """
    if not current_user.house_id:
        raise HTTPException(status_code=400, detail="You must belong to a house first.")

    result = generate_house_chores(db, current_user.house_id)

    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])

    return result


@router.post("/generate-monthly-tickets")
def generate_monthly_tickets_for_house(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Generate monthly tickets for all chores in the house using AI.
    This creates fair assignments based on user preferences and chore data.
    """
    try:
        if not current_user.house_id:
            raise HTTPException(
                status_code=400, detail="You must belong to a house first."
            )

        result = generate_monthly_tickets(db, current_user.house_id)

        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])

        return result
    except HTTPException:
        raise
    except Exception as e:
        # Log the error for debugging
        print(f"Error generating monthly tickets: {str(e)}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.patch("/ticket/{ticket_id}")
def update_ticket_status(
    ticket_id: str,  # UUID string, not int
    update: TicketUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Verify the ticket belongs to the current user's house
    chore = db.query(Chore).filter(Chore.id == ticket.chore_id).first()
    if chore and chore.house_id != current_user.house_id:
        raise HTTPException(status_code=403, detail="Access denied")

    ticket.status = update.status
    if update.status == "Completed":
        from datetime import datetime
        ticket.completed_at = datetime.now()

    db.commit()
    return {"status": "updated", "new_state": ticket.status}


@router.get("/my-tickets")
def get_my_tickets(
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    """
    Get all tickets assigned to the current user with joined chore and user details.
    Returns: List of tickets with chore name, difficulty_level, duration,
             ticket due_date, status, and assigned user name.
    """

    # Join Ticket, Chore, and User tables
    tickets_with_details = (
        db.query(
            Ticket.id.label("ticket_id"),
            Ticket.due_date,
            Ticket.status,
            Chore.name.label("chore_name"),
            Chore.difficulty_level,
            Chore.duration,
            User.name.label("assigned_user_name"),
            Chore.house_id.label("house_id"),
        )
        .join(Chore, Ticket.chore_id == Chore.id)
        .join(User, Ticket.assigned_user_id == User.id)
        .filter(
            Ticket.assigned_user_id == current_user.id,
            Ticket.status != "Completed",
        )
        .all()
    )

    # Convert to response schema
    result = []
    for ticket in tickets_with_details:
        result.append(
            {
                "ticket_id": ticket.ticket_id,
                "due_date": ticket.due_date,
                "status": ticket.status,
                "chore_name": ticket.chore_name,
                "difficulty_level": ticket.difficulty_level,
                "duration": ticket.duration,
                "assigned_user_name": ticket.assigned_user_name,
            }
        )

    return result


@router.patch("/ticket/{ticket_id}/complete")
def mark_ticket_complete(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Mark a specific ticket as complete.
    Sets status to 'Completed' and records completion timestamp.
    """
    from datetime import datetime

    # Find the ticket
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Verify the ticket belongs to the current user
    if ticket.assigned_user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="You can only complete tickets assigned to you"
        )

    # Update ticket status
    ticket.status = "Completed"
    ticket.completed_at = datetime.now()

    db.commit()
    db.refresh(ticket)

    return {
        "status": "success",
        "message": "Ticket marked as complete",
        "ticket_id": ticket.id,
        "completed_at": ticket.completed_at,
    }


@router.patch("/ticket/{ticket_id}/due-date")
def update_ticket_due_date(
    ticket_id: str,
    update: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Update the due date of a specific ticket.
    Expects JSON body: {"due_date": "YYYY-MM-DDTHH:MM:SS"}
    """
    from datetime import datetime

    # Extract due_date from request body
    due_date = update.get("due_date")
    if not due_date:
        raise HTTPException(
            status_code=400, detail="due_date is required in request body"
        )

    # Find the ticket
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Verify the ticket belongs to the current user's house
    chore = db.query(Chore).filter(Chore.id == ticket.chore_id).first()
    if chore.house_id != current_user.house_id:
        raise HTTPException(
            status_code=403, detail="You can only update tickets in your house"
        )

    # Parse and validate the due date
    try:
        new_due_date = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use ISO format: YYYY-MM-DDTHH:MM:SS",
        )

    # Update the due date
    ticket.due_date = new_due_date

    db.commit()
    db.refresh(ticket)

    return {
        "status": "success",
        "message": "Due date updated",
        "ticket_id": ticket.id,
        "new_due_date": ticket.due_date,
    }


@router.patch("/ticket/{ticket_id}/assign")
def update_ticket_assignment(
    ticket_id: str,
    update: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Update the assigned user for a specific ticket.
    Expects JSON body: {"assigned_user_id": "user-uuid"}
    """
    from ...models.model import User

    # Extract assigned_user_id from request body
    assigned_user_id = update.get("assigned_user_id")
    if not assigned_user_id:
        raise HTTPException(
            status_code=400, detail="assigned_user_id is required in request body"
        )

    # Find the ticket
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Verify the ticket belongs to the current user's house
    chore = db.query(Chore).filter(Chore.id == ticket.chore_id).first()
    if chore.house_id != current_user.house_id:
        raise HTTPException(
            status_code=403, detail="You can only reassign tickets in your house"
        )

    # Verify the new assignee exists and is in the same house
    new_assignee = db.query(User).filter(User.id == assigned_user_id).first()

    if not new_assignee:
        raise HTTPException(status_code=404, detail="User not found")

    if new_assignee.house_id != current_user.house_id:
        raise HTTPException(
            status_code=403, detail="Can only assign tickets to users in your house"
        )

    # Update the assignment
    old_assignee_id = ticket.assigned_user_id
    ticket.assigned_user_id = assigned_user_id

    db.commit()
    db.refresh(ticket)

    return {
        "status": "success",
        "message": "Ticket reassigned",
        "ticket_id": ticket.id,
        "old_assignee_id": old_assignee_id,
        "new_assignee_id": assigned_user_id,
        "new_assignee_name": new_assignee.name,
    }


@router.get("/house-chores")
def get_house_chores(
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    """
    Get all chores in the house with joined chore and user details.
    Returns: List of chores with chore name, difficulty_level, duration,
             chore frequency, chore priority, icon, and assigned user name.
    """

    # Join Ticket, Chore, and User tables
    tickets_with_details = (
        db.query(
            Ticket.id.label("ticket_id"),
            Ticket.due_date,
            Ticket.status,
            Chore.name.label("chore_name"),
            Chore.difficulty_level,
            Chore.duration,
            User.name.label("assigned_user_name"),
            Chore.house_id.label("house_id"),
            Chore.chore_frequency.label("frequency"),
            Chore.chore_priority.label("priority"),
            Chore.notes.label("notes"),
        )
        .join(Chore, Ticket.chore_id == Chore.id)
        .join(User, Ticket.assigned_user_id == User.id)
        .filter(
            Chore.house_id == current_user.house_id,
            Ticket.status != "Completed",
        )
        .all()
    )

    # Convert to response schema
    result = []
    for ticket in tickets_with_details:
        result.append(
            {
                "id": ticket.ticket_id,
                "dueDate": ticket.due_date,
                "status": ticket.status,
                "name": ticket.chore_name,
                "difficultyLevel": ticket.difficulty_level,
                "effort": ticket.duration,
                "assignedTo": ticket.assigned_user_name,
                "houseId": ticket.house_id,
                "frequency": ticket.frequency,
                "priority": ticket.priority,
                "notes": ticket.notes,
            }
        )

    return result
