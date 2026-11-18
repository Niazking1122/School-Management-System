from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserOut
from app.auth import get_password_hash, require_role

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.post("/", response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db), admin: User = Depends(require_role(["admin"]))):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists.")
    user = User(username=data.username, hashed_password=get_password_hash(data.password), full_name=data.full_name, role=data.role.value)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.get("/", response_model=List[UserOut])
def get_users(db: Session = Depends(get_db), admin: User = Depends(require_role(["admin"]))):
    return db.query(User).order_by(User.full_name).all()

@router.get("/students", response_model=List[UserOut])
def get_students(db: Session = Depends(get_db), current_user: User = Depends(require_role(["admin", "teacher"]))):
    return db.query(User).filter(User.role == "student").order_by(User.full_name).all()
