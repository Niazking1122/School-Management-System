from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Fee
from app.schemas import FeeCreate, FeeOut
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/api/fees", tags=["Fees"])

@router.post("/", response_model=FeeOut)
def create_fee(data: FeeCreate, db: Session = Depends(get_db), admin: User = Depends(require_role(["admin"]))):
    student = db.query(User).filter(User.id == data.student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    fee = Fee(student_id=data.student_id, amount=data.amount, status="Pending", due_date=data.due_date, created_by=admin.id)
    db.add(fee)
    db.commit()
    db.refresh(fee)
    return fee

@router.get("/", response_model=List[FeeOut])
def get_fees(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Fee)
    if current_user.role == "student":
        query = query.filter(Fee.student_id == current_user.id)
    return query.order_by(Fee.due_date.desc()).all()

@router.patch("/{fee_id}/pay", response_model=FeeOut)
def mark_fee_paid(fee_id: int, db: Session = Depends(get_db), admin: User = Depends(require_role(["admin"]))):
    fee = db.query(Fee).filter(Fee.id == fee_id).first()
    if not fee:
        raise HTTPException(status_code=404, detail="Fee record not found.")
    fee.status = "Paid"
    db.commit()
    db.refresh(fee)
    return fee
