
import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.database import engine, Base, SessionLocal
from app.models import User
from app.auth import get_password_hash
from app.routers import auth, attendance, fees, users, academics

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="School Management System",
    version="2.0.0"
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(attendance.router)
app.include_router(fees.router)
app.include_router(academics.router)


@app.on_event("startup")
def seed_admin():
    username = os.getenv("ADMIN_USERNAME", "").strip()
    password = os.getenv("ADMIN_PASSWORD", "")

    if not username or not password:
        return

    db = SessionLocal()
    try:
        existing = db.query(User).filter(
            User.username == username
        ).first()

        if not existing:
            db.add(
                User(
                    username=username,
                    hashed_password=get_password_hash(password),
                    full_name=os.getenv(
                        "ADMIN_FULL_NAME",
                        "School Administrator"
                    ),
                    role="admin"
                )
            )
            db.commit()
    finally:
        db.close()


app.mount(
    "/static",
    StaticFiles(directory="app/static"),
    name="static"
)


@app.get("/")
def home():
    return FileResponse("app/static/index.html")


@app.get("/health")
def health():
    return {"status": "ok"}
