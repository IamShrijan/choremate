from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes.house import router as house_router
from .api.routes.chores import router as chore_router
from .api.routes.stats import router as game_router
from .api.routes.auth import router as auth_router
from .api.routes.user_preferences import router as user_preferences_router
from .api.routes.user import router as user_router
from .api.routes.chatbot import router as chatbot_router

app = FastAPI(title="Roommate Chore Platform")

from fastapi.middleware.cors import CORSMiddleware

origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
]

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


@app.get("/")
def root():
    return {"message": "Welcome to the Choremate API!"}
