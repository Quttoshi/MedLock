from typing import Optional
from datetime import date
from uuid import UUID

from pydantic import BaseModel, EmailStr


# Request schemas

class PatientRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    date_of_birth: Optional[date] = None
    blood_group: Optional[str] = None
    gender: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# Response schemas

class UserResponse(BaseModel):
    id: UUID
    email: str
    role: str

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModel):
    message: str
