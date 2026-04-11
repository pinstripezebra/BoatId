from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func
from typing import List, Optional
import logging
from pydantic import BaseModel, EmailStr
from models.user import User
from models.car import CarIdentification
from models.refresh_token import RefreshToken
from models.liked_car import LikedCar
from models.car_popularity import CarPopularity
from services.s3_service import S3Service
from utils.database import get_db
from utils.rate_limit import limiter
from passlib.context import CryptContext
import jwt
import os

router = APIRouter()
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security_logger = logging.getLogger("carid.security")

# JWT settings (should match auth.py)
SECRET_KEY = os.getenv("AUTH_SECRET_KEY")
ALGORITHM = "HS256"

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    """Validate JWT token and return current user."""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials - no user ID in token"
            )
        
        # Get user from database
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"User not found with ID: {user_id}"
            )
        
        return user
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication error: {str(e)}"
        )


async def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    """Extract user from JWT if present, return None otherwise."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return db.query(User).filter(User.id == user_id).first()
    except Exception:
        return None

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    location: Optional[str] = None
    phone_number: Optional[str] = None
    description: Optional[str] = None
    created_at: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    location: Optional[str] = None
    phone_number: Optional[str] = None
    description: Optional[str] = None

@router.get("/profile/{user_id}", summary="Get user profile")
async def get_user_profile(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get user profile information.
    """
    try:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return UserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            role=user.role,
            location=user.location,
            phone_number=user.phone_number,
            description=user.description,
            created_at=user.created_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving user profile"
        )

@router.put("/profile/{user_id}", summary="Update user profile")
async def update_user_profile(
    user_id: str,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update user profile information.
    """
    try:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update fields that were provided
        update_data = user_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)
        
        db.commit()
        db.refresh(user)
        
        return UserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            role=user.role,
            location=user.location,
            phone_number=user.phone_number,
            description=user.description,
            created_at=user.created_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating user profile"
        )

@router.get("/", summary="Get all users (admin only)")
async def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """
    Get list of all users (admin functionality).
    """
    try:
        users = db.query(User).offset(offset).limit(limit).all()
        
        return [
            UserResponse(
                id=str(user.id),
                username=user.username,
                email=user.email,
                role=user.role,
                location=user.location,
                phone_number=user.phone_number,
                description=user.description,
                created_at=user.created_at.isoformat()
            )
            for user in users
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving users"
        )

@router.delete("/delete-account", summary="Delete current user account")
@limiter.limit("3/minute")
async def delete_account(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Permanently delete the current user's account and all associated data.
    """
    try:
        user_id = current_user.id

        # 1. Get liked car IDs for popularity decrement
        liked_car_ids = db.query(LikedCar.car_id).filter(
            LikedCar.user_id == user_id
        ).all()
        liked_car_ids = [row[0] for row in liked_car_ids]

        # 2. Delete liked_cars
        db.query(LikedCar).filter(LikedCar.user_id == user_id).delete()

        # 3. Decrement car_popularity for affected cars
        if liked_car_ids:
            db.query(CarPopularity).filter(
                CarPopularity.id.in_(liked_car_ids)
            ).update(
                {CarPopularity.likes: CarPopularity.likes - 1},
                synchronize_session='fetch'
            )

        # 4. Collect S3 keys before deleting car_identifications
        s3_keys = db.query(CarIdentification.s3_image_key).filter(
            CarIdentification.user_id == user_id
        ).all()
        s3_keys = [row[0] for row in s3_keys if row[0]]

        # 5. Delete car_identifications
        db.query(CarIdentification).filter(
            CarIdentification.user_id == user_id
        ).delete()

        # 6. Delete refresh_tokens
        db.query(RefreshToken).filter(RefreshToken.user_id == str(user_id)).delete()

        # 7. Delete user
        db.query(User).filter(User.id == user_id).delete()

        db.commit()

        security_logger.info("Account deleted: user_id=%s username=%s", user_id, current_user.username)

        # 8. Clean up S3 images (after commit so failures don't rollback)
        if s3_keys:
            try:
                s3_service = S3Service()
                for key in s3_keys:
                    await s3_service.delete_image(key)
            except Exception as e:
                print(f"Warning: S3 cleanup failed for user {user_id}: {e}")

        return {"message": "Account deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        security_logger.error("Account deletion error for user %s: %s", current_user.id, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error deleting account"
        )