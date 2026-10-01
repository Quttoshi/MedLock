from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.jwt import bearer_scheme, get_current_user, revoke_token
from app.models.user import User
from app.schemas.auth import (
    PatientRegisterRequest,
    DoctorRegisterRequest,
    MedicalCenterRegisterRequest,
    AdminRegisterRequest,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RegisterResponse,
    ResendVerificationRequest,
    UserResponse,
    VerifyEmailRequest,
)
from app.services.auth_service import (
    register_patient,
    register_doctor,
    register_medical_center,
    register_admin,
    login_user,
)
from app.services.audit_service import log_action
from app.services.email_verification_service import (
    is_verification_required,
    resend_verification_email,
    send_verification_email,
    verify_email_token,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(data: PatientRegisterRequest, request: Request, db: Session = Depends(get_db)):
    user = register_patient(data, db)
    log_action(db, action="register", performed_by=user.id, entity_type="user", entity_id=user.id, request=request)
    return _registered(user)


@router.post("/register/doctor", response_model=RegisterResponse, status_code=201)
def register_doctor_route(data: DoctorRegisterRequest, request: Request, db: Session = Depends(get_db)):
    user = register_doctor(data, db)
    log_action(db, action="register", performed_by=user.id, entity_type="user", entity_id=user.id, request=request)
    return _registered(user)


@router.post("/register/medical-center", response_model=RegisterResponse, status_code=201)
def register_medical_center_route(data: MedicalCenterRegisterRequest, request: Request, db: Session = Depends(get_db)):
    user = register_medical_center(data, db)
    log_action(db, action="register", performed_by=user.id, entity_type="user", entity_id=user.id, request=request)
    return _registered(user)


@router.post("/register/admin", response_model=RegisterResponse, status_code=201)
def register_admin_route(data: AdminRegisterRequest, request: Request, db: Session = Depends(get_db)):
    user = register_admin(data, db)
    log_action(db, action="register", performed_by=user.id, entity_type="user", entity_id=user.id, request=request)
    return _registered(user)


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    result = login_user(data, db)
    log_action(db, action="login", performed_by=result["user"].id, entity_type="user", entity_id=result["user"].id, request=request)
    return result


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    revoke_token(credentials.credentials, db)
    log_action(db, action="logout", performed_by=current_user.id, entity_type="user", entity_id=current_user.id, request=request)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(data: VerifyEmailRequest, request: Request, db: Session = Depends(get_db)):
    user = verify_email_token(data.token, db)
    log_action(db, action="email_verified", performed_by=user.id, entity_type="user", entity_id=user.id, request=request)
    return {"message": "Your email address is confirmed. You can now log in."}


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(data: ResendVerificationRequest, db: Session = Depends(get_db)):
    resend_verification_email(data.email, db)
    # Same reply whether or not the account exists, so emails can't be probed.
    return {"message": "If that account exists and is not yet confirmed, a new confirmation email has been sent."}


def _registered(user: User) -> RegisterResponse:
    required = is_verification_required()
    if required:
        send_verification_email(user)
    response = RegisterResponse.model_validate(UserResponse.model_validate(user).model_dump())
    response.email_verification_required = required
    return response
