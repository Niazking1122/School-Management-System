
import enum
from sqlalchemy import (
from sqlalchemy.orm import relationship
    Column, Integer, String, Float, ForeignKey, Date,
    UniqueConstraint
)
from app.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    teacher = "teacher"
    student = "student"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="student")
    full_name = Column(String(160), nullable=False)

    attendance = relationship(
        "Attendance",
        back_populates="student",
        foreign_keys="Attendance.student_id"
    )
    fees = relationship(
        "Fee",
        back_populates="student",
        foreign_keys="Fee.student_id"
    )


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("student_id", "date", name="uq_student_attendance_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False)
    marked_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    student = relationship(
        "User",
        back_populates="attendance",
        foreign_keys=[student_id]
    )


class Fee(Base):
    __tablename__ = "fees"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    status = Column(String(20), nullable=False, default="Pending")
    due_date = Column(Date, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    student = relationship(
        "User",
        back_populates="fees",
        foreign_keys=[student_id]
    )


class SchoolClass(Base):
    __tablename__ = "school_classes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("student_id", "class_id", name="uq_student_class"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("school_classes.id"), nullable=False)


class ClassSubject(Base):
    __tablename__ = "class_subjects"
    __table_args__ = (
        UniqueConstraint("class_id", "subject_id", name="uq_class_subject"),
    )

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("school_classes.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)


class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(120), nullable=False)
    class_id = Column(Integer, ForeignKey("school_classes.id"), nullable=False)
    exam_date = Column(Date, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)


class Mark(Base):
    __tablename__ = "marks"
    __table_args__ = (
        UniqueConstraint(
            "student_id", "subject_id", "exam_id",
            name="uq_student_subject_exam"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    obtained_marks = Column(Float, nullable=False)
    total_marks = Column(Float, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
