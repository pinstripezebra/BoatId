from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import boto3
import jwt
import os

from models.badge import Badge
from models.user import User
from models.user_badge import UserBadge
from utils.database import get_db

router = APIRouter()
security = HTTPBearer()

SECRET_KEY = os.getenv("AUTH_SECRET_KEY")
ALGORITHM = "HS256"
BUCKET = os.getenv("AWS_BUCKET_NAME", "carid-images")
REGION = os.getenv("AWS_REGION", "us-west-2")

s3_client = boto3.client("s3", region_name=REGION)

PRESIGN_EXPIRY = 60 * 60 * 24 * 7  # 7 days


def _get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


class BadgeResponse(BaseModel):
    id: int
    name: str
    required_images: int
    image_url: Optional[str]
    earned: bool

    class Config:
        from_attributes = True


@router.get("/users/me/badges", response_model=List[BadgeResponse], summary="Get all badges for current user")
async def get_my_badges(
    current_user: User = Depends(_get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all 4 badges with earned:bool and a presigned S3 image URL.
    Badges with no s3_key will have image_url=null.
    """
    all_badges = db.query(Badge).order_by(Badge.required_images).all()

    earned_ids = {
        row.badge_id
        for row in db.query(UserBadge).filter(UserBadge.user_id == current_user.id).all()
    }

    result = []
    for badge in all_badges:
        image_url = None
        if badge.s3_key:
            try:
                image_url = s3_client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": BUCKET, "Key": badge.s3_key},
                    ExpiresIn=PRESIGN_EXPIRY,
                )
            except Exception:
                image_url = None

        result.append(
            BadgeResponse(
                id=badge.id,
                name=badge.name,
                required_images=badge.required_images,
                image_url=image_url,
                earned=badge.id in earned_ids,
            )
        )

    return result
