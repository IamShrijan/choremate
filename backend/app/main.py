from fastapi import FastAPI

from .api.routes.house import router as house_router
from .api.routes.chores import router as chore_router
from .api.routes.stats import router as game_router
from .api.routes.auth import router as auth_router


app = FastAPI(title="Roommate Chore Platform")

# --- Register Routers ---
app.include_router(auth_router)
app.include_router(house_router)
app.include_router(chore_router)
app.include_router(game_router)


@app.get("/")
def root():
    return {"message": "Welcome to the Choremate API!"}
