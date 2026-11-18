
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    User, SchoolClass, Subject, Enrollment,
    ClassSubject, Exam, Mark
)
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/api/academics", tags=["Academics"])


class ClassCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class SubjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class EnrollmentCreate(BaseModel):
    student_id: int
    class_id: int


class ClassSubjectCreate(BaseModel):
    class_id: int
    subject_id: int


class ExamCreate(BaseModel):
    title: str
    class_id: int
    exam_date: date


class MarkCreate(BaseModel):
    student_id: int
    subject_id: int
    exam_id: int
    obtained_marks: float = Field(ge=0)
    total_marks: float = Field(gt=0)


@router.get("/classes")
def get_classes(db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    return db.query(SchoolClass).order_by(SchoolClass.name).all()


@router.post("/classes")
def create_class(data: ClassCreate,
                 db: Session = Depends(get_db),
                 admin: User = Depends(require_role(["admin"]))):
    if db.query(SchoolClass).filter(SchoolClass.name == data.name).first():
        raise HTTPException(400, "Class already exists.")
    item = SchoolClass(name=data.name)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/subjects")
def get_subjects(db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    return db.query(Subject).order_by(Subject.name).all()


@router.post("/subjects")
def create_subject(data: SubjectCreate,
                   db: Session = Depends(get_db),
                   admin: User = Depends(require_role(["admin"]))):
    if db.query(Subject).filter(Subject.name == data.name).first():
        raise HTTPException(400, "Subject already exists.")
    item = Subject(name=data.name)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/enrollments")
def enroll_student(data: EnrollmentCreate,
                   db: Session = Depends(get_db),
                   admin: User = Depends(require_role(["admin"]))):
    student = db.query(User).filter(
        User.id == data.student_id, User.role == "student"
    ).first()
    school_class = db.query(SchoolClass).filter(
        SchoolClass.id == data.class_id
    ).first()

    if not student or not school_class:
        raise HTTPException(404, "Student or class not found.")

    exists = db.query(Enrollment).filter(
        Enrollment.student_id == data.student_id,
        Enrollment.class_id == data.class_id
    ).first()
    if exists:
        raise HTTPException(400, "Student is already in this class.")

    item = Enrollment(student_id=data.student_id, class_id=data.class_id)
    db.add(item)
    db.commit()
    return {"message": "Student enrolled successfully."}


@router.post("/class-subjects")
def add_class_subject(data: ClassSubjectCreate,
                      db: Session = Depends(get_db),
                      admin: User = Depends(require_role(["admin"]))):
    if not db.query(SchoolClass).filter(
        SchoolClass.id == data.class_id
    ).first():
        raise HTTPException(404, "Class not found.")

    if not db.query(Subject).filter(
        Subject.id == data.subject_id
    ).first():
        raise HTTPException(404, "Subject not found.")

    exists = db.query(ClassSubject).filter(
        ClassSubject.class_id == data.class_id,
        ClassSubject.subject_id == data.subject_id
    ).first()
    if exists:
        raise HTTPException(400, "Subject already assigned to this class.")

    item = ClassSubject(
        class_id=data.class_id,
        subject_id=data.subject_id
    )
    db.add(item)
    db.commit()
    return {"message": "Subject assigned successfully."}


@router.get("/class-subjects/{class_id}")
def get_class_subjects(class_id: int,
                       db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    rows = (
        db.query(Subject)
        .join(ClassSubject, ClassSubject.subject_id == Subject.id)
        .filter(ClassSubject.class_id == class_id)
        .order_by(Subject.name)
        .all()
    )
    return rows


@router.post("/exams")
def create_exam(data: ExamCreate,
                db: Session = Depends(get_db),
                user: User = Depends(require_role(["admin", "teacher"]))):
    if not db.query(SchoolClass).filter(
        SchoolClass.id == data.class_id
    ).first():
        raise HTTPException(404, "Class not found.")

    exam = Exam(
        title=data.title,
        class_id=data.class_id,
        exam_date=data.exam_date,
        created_by=user.id
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam


@router.get("/exams")
def get_exams(db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    query = db.query(Exam)

    if user.role == "student":
        class_ids = db.query(Enrollment.class_id).filter(
            Enrollment.student_id == user.id
        ).subquery()
        query = query.filter(Exam.class_id.in_(class_ids))

    return query.order_by(Exam.exam_date.desc()).all()


@router.post("/marks")
def add_mark(data: MarkCreate,
             db: Session = Depends(get_db),
             user: User = Depends(require_role(["admin", "teacher"]))):
    if data.obtained_marks > data.total_marks:
        raise HTTPException(400, "Obtained marks cannot exceed total marks.")

    student = db.query(User).filter(
        User.id == data.student_id, User.role == "student"
    ).first()
    exam = db.query(Exam).filter(Exam.id == data.exam_id).first()
    subject = db.query(Subject).filter(
        Subject.id == data.subject_id
    ).first()

    if not student or not exam or not subject:
        raise HTTPException(404, "Student, exam or subject not found.")

    enrolled = db.query(Enrollment).filter(
        Enrollment.student_id == student.id,
        Enrollment.class_id == exam.class_id
    ).first()
    if not enrolled:
        raise HTTPException(400, "Student is not enrolled in this exam class.")

    assigned = db.query(ClassSubject).filter(
        ClassSubject.class_id == exam.class_id,
        ClassSubject.subject_id == subject.id
    ).first()
    if not assigned:
        raise HTTPException(400, "Subject is not assigned to this class.")

    item = db.query(Mark).filter(
        Mark.student_id == student.id,
        Mark.subject_id == subject.id,
        Mark.exam_id == exam.id
    ).first()

    if item:
        item.obtained_marks = data.obtained_marks
        item.total_marks = data.total_marks
        item.created_by = user.id
    else:
        item = Mark(
            student_id=student.id,
            subject_id=subject.id,
            exam_id=exam.id,
            obtained_marks=data.obtained_marks,
            total_marks=data.total_marks,
            created_by=user.id
        )
        db.add(item)

    db.commit()
    db.refresh(item)
    return item


@router.get("/marks")
def get_marks(student_id: Optional[int] = None,
              db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    query = db.query(Mark)

    if user.role == "student":
        query = query.filter(Mark.student_id == user.id)
    elif student_id is not None:
        query = query.filter(Mark.student_id == student_id)

    return query.order_by(Mark.exam_id.desc()).all()
