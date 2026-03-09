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
from app.services.audit_service import log_action

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: PatientRegisterRequest, request: Request, db: Session = Depends(get_db)):
    user = register_patient(data, db)
    log_action(db, action="register", performed_by=user.id, entity_type="user", entity_id=user.id, request=request)
    return user


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    result = login_user(data, db)
    log_action(db, action="login", performed_by=result["user"].id, entity_type="user", entity_id=result["user"].id, request=request)
    return result


@router.post("/logout", response_model=MessageResponse)
def logout(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log_action(db, action="logout", performed_by=current_user.id, entity_type="user", entity_id=current_user.id, request=request)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
