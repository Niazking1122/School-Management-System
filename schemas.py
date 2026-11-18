from datetime import date
from pydantic import BaseModel, ConfigDict, Field
from app.models import UserRole

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=160)
    role: UserRole

class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str

class AttendanceCreate(BaseModel):
    student_id: int
    date: date
    status: str

class AttendanceOut(BaseModel):
    id: int
    student_id: int
    date: date
    status: str
    model_config = ConfigDict(from_attributes=True)

class FeeCreate(BaseModel):
    student_id: int
    amount: float = Field(gt=0)
    due_date: date

class FeeOut(BaseModel):
    id: int
    student_id: int
    amount: float
    status: str
    due_date: date
    model_config = ConfigDict(from_attributes=True)
