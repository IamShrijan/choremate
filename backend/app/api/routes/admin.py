import asyncio
from datetime import datetime, timedelta
import random
import uuid

from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text

# Import Celery context for queue metrics
try:
    from celery.task.control import inspect
except ImportError:
    inspect = None

from ...db.database import get_db
from ...core.security import hash_password
from ...models.model import (
    House,
    User,
    UserPreference,
    Chore,
    Ticket,
    Notification,
    AIConversation,
)
from ...core.notifications_bus import publish_notification_sync

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/seed")
def seed_database(db: Session = Depends(get_db)):
    try:
        is_postgres = "postgresql" in str(db.get_bind().url)
        
        if is_postgres:
            db.execute(text("TRUNCATE TABLE houses, users, user_preferences, chores, tickets, appreciations, swap_requests, notifications, appreciation_events, feedback, ai_conversations CASCADE;"))
        else:
            db.query(AIConversation).delete()
            db.query(Notification).delete()
            db.query(Ticket).delete()
            db.query(Chore).delete()
            db.query(UserPreference).delete()
            db.query(User).delete()
            db.query(House).delete()
            
        db.commit()

        house_id = str(uuid.uuid4())
        house = House(
            id=house_id,
            name="The CS 6620 Manor",
            address="123 Distributed Way",
            invite_code="CS6620",
        )
        db.add(house)
        db.commit()

        users = []
        base_password = hash_password("pass123")
        for i in range(1, 5):
            u = User(
                id=str(uuid.uuid4()),
                name=f"Roommate {i}",
                email=f"roommate{i}@choremate.local",
                password=base_password,
                house_id=house_id,
                user_profile={"avatar_color": f"#{random.randint(0, 0xFFFFFF):06x}"}
            )
            db.add(u)
            users.append(u)
        
        db.commit()

        for u in users:
            pref = UserPreference(
                user_id=u.id,
                cleanliness_level=random.randint(2, 5),
                day_availability=["weekday", "weekend"],
            )
            db.add(pref)
        db.commit()

        chores = []
        chore_names = ["Wash Dishes", "Vacuum Living Room", "Take out Trash", "Clean Bathroom", "Mow Lawn", "Groceries", "Dusting", "Mop Kitchen"]
        for i in range(20):
            c = Chore(
                id=str(uuid.uuid4()),
                name=f"{random.choice(chore_names)} {i}",
                difficulty_level=random.randint(1, 4),
                duration=random.randint(10, 60),
                chore_frequency="Weekly",
                chore_priority=random.randint(1, 3),
                house_id=house_id
            )
            db.add(c)
            chores.append(c)
        db.commit()

        for _ in range(30):
            t = Ticket(
                id=str(uuid.uuid4()),
                chore_id=random.choice(chores).id,
                assigned_user_id=random.choice(users).id,
                status="Completed",
                due_date=datetime.now() - timedelta(days=random.randint(1, 15)),
                completed_at=datetime.now() - timedelta(days=random.randint(1, 15)),
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            db.add(t)
            db.commit()

        for _ in range(20):
            t = Ticket(
                id=str(uuid.uuid4()),
                chore_id=random.choice(chores).id,
                assigned_user_id=random.choice(users).id,
                status="Pending",
                due_date=datetime.now() + timedelta(days=random.randint(1, 7)),
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            db.add(t)
            db.commit()

        return {"status": "success", "message": "Database wiped and seeded for Experiment Execution."}
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


def _push_burst(count: int, user_id: str, db: Session):
    for i in range(count):
        # Insert a real notification in DB so the client will fetch it
        n = Notification(
            user_id=user_id,
            notification_type="SYSTEM_BURST",
            title="Burst Event",
            message=str(time.time()),
            related_id=str(uuid.uuid4()),
            created_at=datetime.now()
        )
        db.add(n)

    db.commit()
    # ONE signal is enough — SSE clients re-fetch all unread notifications on receipt.
    # Sending N signals floods the asyncio event loop with N coroutines for no benefit.
    publish_notification_sync(user_id)


import time
@router.post("/trigger-burst")
def trigger_burst(count: int = Query(50), background_tasks: BackgroundTasks = BackgroundTasks(), db: Session = Depends(get_db)):
    """
    Endpoint for Experiment 2. Instantly generates N events and pushes them to Redis via SSE.
    Requires at least one user in the DB.
    """
    user = db.query(User).first()
    if not user:
        return {"error": "No users found. Run /seed first."}
        
    background_tasks.add_task(_push_burst, count, str(user.id), db)
    return {"status": "triggering", "count": count, "target_user_id": user.id}


@router.get("/queue-depth")
def get_queue_depth():
    """
    Endpoint for Experiment 3. Attempts to read Celery queue sizes.
    """
    try:
        from celery import Celery
        import os
        celery_app = Celery("choremate", broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"))
        
        with celery_app.connection_or_acquire() as conn:
            # Query standard task queue
            size = conn.default_channel.client.llen("celery")
            return {"queue": "celery", "depth": size}
    except Exception as e:
        return {"error": str(e), "depth": -1}
