from fastapi import FastAPI

from .api.routes.house import router as house_router
from .api.routes.chores import router as chore_router
from .api.routes.stats import router as game_router
from .api.routes.auth import router as auth_router
from .api.routes.user_preferences import router as user_preferences_router
from .api.routes.user import router as user_router

app = FastAPI(title="Roommate Chore Platform")

# --- Register Routers ---
app.include_router(auth_router)
app.include_router(house_router)
app.include_router(user_preferences_router)
app.include_router(user_router)
app.include_router(chore_router)
app.include_router(game_router)


@app.get("/")
def root():
    return {"message": "Welcome to the Choremate API!"}
