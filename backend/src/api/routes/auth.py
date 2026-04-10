from fastapi import APIRouter, Depends, HTTPException, status, Form, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta, timezone
from typing import Optional, Union
import re
import random
import jwt
import secrets
import hashlib
import uuid
import logging
from passlib.context import CryptContext
from models.user import User
from models.refresh_token import RefreshToken
from utils.database import get_db
from utils.rate_limit import limiter
from services.email_service import send_verification_email
import os

router = APIRouter()
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security_logger = logging.getLogger("boatid.security")

# JWT settings
SECRET_KEY = os.getenv("AUTH_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("AUTH_SECRET_KEY environment variable is required")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours – mobile clients use refresh-token rotation for revocation
REFRESH_TOKEN_EXPIRE_DAYS = 30

class UserRegistration(BaseModel):
    username: str
    password: str
    email: EmailStr
    role: str = "renter"  # Default role
    location: Optional[str] = None
    phone_number: Optional[str] = None
    description: Optional[str] = None

def validate_password_strength(password: str) -> list[str]:
    """Return a list of password requirement violations."""
    errors = []
    if len(password) < 8:
        errors.append("Password must be at least 8 characters long")
    if not re.search(r'[A-Z]', password):
        errors.append("Password must contain at least one uppercase letter")
    if not re.search(r'[a-z]', password):
        errors.append("Password must contain at least one lowercase letter")
    if not re.search(r'[0-9]', password):
        errors.append("Password must contain at least one number")
    if not re.search(r'[^A-Za-z0-9]', password):
        errors.append("Password must contain at least one special character")
    return errors

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user_id: str
    username: str
    role: str

class RefreshRequest(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    refresh_token: str

class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str

class ResendVerificationRequest(BaseModel):
    email: EmailStr

def generate_verification_code() -> str:
    """Generate a cryptographically random 6-digit code."""
    return str(random.SystemRandom().randint(100000, 999999))

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    # Always truncate to 72 bytes for bcrypt compatibility
    plain_password = plain_password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password."""
    # Always truncate to 72 bytes for bcrypt compatibility
    password = password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """Authenticate a user by username and password."""
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password):
        return None
    return user

def hash_refresh_token(token: str) -> str:
    """Hash a refresh token with SHA-256 for secure storage."""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()

def create_refresh_token(db: Session, user_id: str) -> str:
    """Generate a cryptographically random refresh token and store its hash in the database."""
    raw_token = secrets.token_urlsafe(64)
    token_hash = hash_refresh_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    db_token = RefreshToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
        revoked=False,
    )
    db.add(db_token)
    db.commit()
    return raw_token

@router.post("/register", summary="Register new user")
@limiter.limit("5/minute")
async def register_user(
    request: Request,
    user_data: UserRegistration,
    db: Session = Depends(get_db)
):
    """
    Register a new user account.
    """
    try:
        # Validate password strength
        password_errors = validate_password_strength(user_data.password)
        if password_errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=password_errors[0]
            )

        # Check if username or email already exists
        existing_user = db.query(User).filter(
            (User.username == user_data.username) | 
            (User.email == user_data.email)
        ).first()
        
        if existing_user:
            security_logger.warning("Registration attempt with existing username/email: %s from %s", user_data.username, request.client.host if request.client else "unknown")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username or email already registered"
            )
        
        # Hash the password
        hashed_password = get_password_hash(user_data.password)
        
        # Create new user
        new_user = User(
            username=user_data.username,
            password=hashed_password,
            email=user_data.email,
            email_verified=False,
            role=user_data.role,
            location=user_data.location,
            phone_number=user_data.phone_number,
            description=user_data.description
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # Generate and store verification code
        code = generate_verification_code()
        new_user.verification_code = code
        new_user.verification_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        db.commit()

        # Send verification email
        send_verification_email(new_user.email, code)
        
        return {
            "message": "Verification email sent",
            "email": new_user.email
        }
        
    except HTTPException:
        raise
    except Exception as e:
        security_logger.error("Registration error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error registering user"
        )

@router.post("/token", summary="OAuth2 compliant token endpoint")
@limiter.limit("10/minute")
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    OAuth2 compliant token endpoint - supports form data.
    Compatible with FastAPI's automatic OAuth2 documentation.
    """
    try:
        user = authenticate_user(db, form_data.username, form_data.password)
        if not user:
            security_logger.warning("Failed login (token) for user '%s' from %s", form_data.username, request.client.host if request.client else "unknown")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified",
                headers={"X-Email": user.email},
            )
        
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id), "username": user.username, "role": user.role},
            expires_delta=access_token_expires
        )
        refresh_token = create_refresh_token(db, str(user.id))
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user_id": str(user.id),
            "username": user.username,
            "role": user.role
        }
        
    except HTTPException:
        raise
    except Exception as e:
        security_logger.error("Login (token) error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error during login"
        )

@router.post("/login", summary="Mobile-friendly JSON login")
@limiter.limit("10/minute")
async def login_user(
    request: Request,
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    """
    Mobile-friendly JSON login endpoint.
    Provides the same functionality as /token but accepts JSON.
    """
    try:
        user = authenticate_user(db, login_data.username, login_data.password)
        if not user:
            security_logger.warning("Failed login for user '%s' from %s", login_data.username, request.client.host if request.client else "unknown")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified",
                headers={"X-Email": user.email},
            )
        
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id), "username": user.username, "role": user.role},
            expires_delta=access_token_expires
        )
        refresh_token = create_refresh_token(db, str(user.id))
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user_id=str(user.id),
            username=user.username,
            role=user.role
        )
        
    except HTTPException:
        raise
    except Exception as e:
        security_logger.error("Login error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error during login"
        )

@router.post("/refresh", summary="Refresh access token")
@limiter.limit("30/minute")
async def refresh_token(
    request: Request,
    refresh_data: RefreshRequest,
    db: Session = Depends(get_db)
):
    """
    Exchange a valid refresh token for a new access token and rotated refresh token.
    """
    try:
        token_hash = hash_refresh_token(refresh_data.refresh_token)
        stored_token = db.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
        ).first()

        if not stored_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )

        if stored_token.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            stored_token.revoked = True
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token expired"
            )

        # Verify user still exists
        user = db.query(User).filter(User.id == stored_token.user_id).first()
        if not user:
            stored_token.revoked = True
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )

        # Revoke the old refresh token (rotation)
        stored_token.revoked = True
        db.commit()

        # Issue new access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id), "username": user.username, "role": user.role},
            expires_delta=access_token_expires
        )

        # Issue new rotated refresh token
        new_refresh_token = create_refresh_token(db, str(user.id))

        return Token(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            user_id=str(user.id),
            username=user.username,
            role=user.role
        )

    except HTTPException:
        raise
    except Exception as e:
        security_logger.error("Token refresh error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error refreshing token"
        )

@router.post("/logout", summary="Revoke refresh token")
async def logout(
    logout_data: LogoutRequest,
    db: Session = Depends(get_db)
):
    """
    Revoke a refresh token on logout.
    """
    try:
        token_hash = hash_refresh_token(logout_data.refresh_token)
        stored_token = db.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash,
        ).first()

        if stored_token:
            stored_token.revoked = True
            db.commit()

        return {"message": "Logged out successfully"}

    except Exception as e:
        security_logger.error("Logout error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error during logout"
        )

@router.post("/verify-email", summary="Verify email with code")
@limiter.limit("10/minute")
async def verify_email(
    request: Request,
    verify_data: VerifyEmailRequest,
    db: Session = Depends(get_db)
):
    """
    Verify a user's email address using the 6-digit code sent during registration.
    On success, returns access and refresh tokens (auto-login).
    """
    try:
        user = db.query(User).filter(User.email == verify_data.email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No account found with that email"
            )

        if user.email_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already verified"
            )

        if not user.verification_code or not user.verification_code_expires_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No verification code pending. Request a new one."
            )

        if user.verification_code_expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has expired. Request a new one."
            )

        if user.verification_code != verify_data.code:
            security_logger.warning("Invalid verification code for %s from %s", verify_data.email, request.client.host if request.client else "unknown")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code"
            )

        # Mark email as verified and clear code
        user.email_verified = True
        user.verification_code = None
        user.verification_code_expires_at = None
        db.commit()

        security_logger.info("Email verified for user %s (%s)", user.id, user.email)

        # Auto-login: issue tokens
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id), "username": user.username, "role": user.role},
            expires_delta=access_token_expires
        )
        refresh_token = create_refresh_token(db, str(user.id))

        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user_id=str(user.id),
            username=user.username,
            role=user.role
        )

    except HTTPException:
        raise
    except Exception as e:
        security_logger.error("Email verification error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error verifying email"
        )

@router.post("/resend-verification", summary="Resend verification code")
@limiter.limit("3/minute")
async def resend_verification(
    request: Request,
    resend_data: ResendVerificationRequest,
    db: Session = Depends(get_db)
):
    """
    Generate and send a new verification code to the user's email.
    """
    try:
        user = db.query(User).filter(User.email == resend_data.email).first()
        if not user:
            # Return success even if not found to prevent email enumeration
            return {"message": "If that email exists, a new code has been sent"}

        if user.email_verified:
            return {"message": "Email already verified"}

        # Generate new code
        code = generate_verification_code()
        user.verification_code = code
        user.verification_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        db.commit()

        send_verification_email(user.email, code)

        return {"message": "If that email exists, a new code has been sent"}

    except Exception as e:
        security_logger.error("Resend verification error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error resending verification code"
        )