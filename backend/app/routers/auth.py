from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.jwt import get_current_user
from app.models.user import User
from app.schemas.auth import (
    PatientRegisterRequest,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    UserResponse,
)
from app.services.auth_service import register_patient, login_user

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: PatientRegisterRequest, db: Session = Depends(get_db)):
    user = register_patient(data, db)
    return user


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    result = login_user(data, db)
    return result


@router.post("/logout", response_model=MessageResponse)
def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
