from typing import Optional
from datetime import date
from uuid import UUID

from pydantic import BaseModel, EmailStr, model_validator


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


class DoctorRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    specialization: str
    license_number: str


class MedicalCenterRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    center_name: str
    license_number: str
    address: str


class AdminRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    admin_secret: str
    admin_level: Optional[str] = "standard"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# Response schemas

class UserResponse(BaseModel):
    id: UUID
    name: Optional[str] = None
    email: str
    role: str

    @model_validator(mode="before")
    @classmethod
    def extract_fields(cls, data):
        if hasattr(data, "full_name"):
            return {
                "id": data.id,
                "name": data.full_name,
                "email": data.email,
                "role": data.role,
            }
        return data

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModel):
    message: str
