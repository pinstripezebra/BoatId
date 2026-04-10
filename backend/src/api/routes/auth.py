from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta, timezone
from typing import Optional, Union
import jwt
import secrets
import hashlib
import uuid
from passlib.context import CryptContext
from models.user import User
from models.refresh_token import RefreshToken
from utils.database import get_db
import os

router = APIRouter()
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "your-secret-key-here")  # Change in production
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
async def register_user(
    user_data: UserRegistration,
    db: Session = Depends(get_db)
):
    """
    Register a new user account.
    """
    try:
        # Check if username or email already exists
        existing_user = db.query(User).filter(
            (User.username == user_data.username) | 
            (User.email == user_data.email)
        ).first()
        
        if existing_user:
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
            role=user_data.role,
            location=user_data.location,
            phone_number=user_data.phone_number,
            description=user_data.description
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return {
            "message": "User registered successfully",
            "user_id": str(new_user.id),
            "username": new_user.username
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error registering user: {str(e)}"
        )

@router.post("/token", summary="OAuth2 compliant token endpoint")
async def login_for_access_token(
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
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during login: {str(e)}"
        )

@router.post("/login", summary="Mobile-friendly JSON login")
async def login_user(
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
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during login: {str(e)}"
        )

@router.post("/refresh", summary="Refresh access token")
async def refresh_token(
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error refreshing token: {str(e)}"
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during logout: {str(e)}"
        )