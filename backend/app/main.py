import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes.house import router as house_router
from .api.routes.chores import router as chore_router
from .api.routes.stats import router as game_router
from .api.routes.auth import router as auth_router
from .api.routes.user_preferences import router as user_preferences_router
from .api.routes.user import router as user_router
from .api.routes.chatbot import router as chatbot_router
from .api.routes.notifications import router as notifications_router
from .api.routes.admin import router as admin_router

from .db.database import engine, Base
from .core.notifications_bus import set_main_loop

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Store the running asyncio event loop so sync handlers can schedule SSE publishes."""
    set_main_loop(asyncio.get_event_loop())
    yield


app = FastAPI(title="Roommate Chore Platform", lifespan=lifespan)


# ALLOWED_ORIGINS env var: comma-separated list of allowed origins.
# In production, injected via SSM → ECS task environment.
# e.g. "http://my-alb-123.us-east-1.elb.amazonaws.com,https://choremate.example.com"
_extra_origins = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]

origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
] + _extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Register Routers ---
app.include_router(auth_router)
app.include_router(house_router)
app.include_router(user_preferences_router)
app.include_router(user_router)
app.include_router(chore_router)
app.include_router(game_router)
app.include_router(chatbot_router)
app.include_router(
    notifications_router, prefix="/notifications", tags=["notifications"]
)
app.include_router(admin_router)


@app.get("/")
def root():
    return {"message": "Welcome to the Choremate API!"}
