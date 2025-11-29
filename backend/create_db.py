# backend/create_db.py
from app.db.database import engine, Base
from app.models import model  # ensures models are imported and registered

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("Database tables created.")
