from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Attendance
from app.schemas import AttendanceCreate, AttendanceOut
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])

@router.post("/", response_model=AttendanceOut)
def mark_attendance(data: AttendanceCreate, db: Session = Depends(get_db), teacher_or_admin: User = Depends(require_role(["admin", "teacher"]))):
    if data.status not in ("Present", "Absent", "Late"):
        raise HTTPException(status_code=400, detail="Status must be Present, Absent or Late.")
    student = db.query(User).filter(User.id == data.student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    record = db.query(Attendance).filter(Attendance.student_id == data.student_id, Attendance.date == data.date).first()
    if record:
        record.status = data.status
        record.marked_by = teacher_or_admin.id
    else:
        record = Attendance(student_id=data.student_id, date=data.date, status=data.status, marked_by=teacher_or_admin.id)
        db.add(record)
    db.commit()
    db.refresh(record)
    return record

@router.get("/", response_model=List[AttendanceOut])
def get_attendance(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Attendance)
    if current_user.role == "student":
        query = query.filter(Attendance.student_id == current_user.id)
    return query.order_by(Attendance.date.desc()).all()
