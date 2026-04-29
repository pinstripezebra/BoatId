from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from utils.database import get_db
from models.user_camera_stats import UserCameraStats
import os

router = APIRouter()

_RESET_SECRET = os.getenv("EVENTBRIDGE_RESET_SECRET")


@router.post("/reset-weekly", summary="Reset weekly camera counts (EventBridge)")
async def reset_weekly_counts(request: Request, db: Session = Depends(get_db)):
    """
    Called by AWS EventBridge every Sunday at midnight UTC.
    Requires the X-Reset-Secret header to match EVENTBRIDGE_RESET_SECRET env var.
    """
    secret = request.headers.get("X-Reset-Secret")
    if not _RESET_SECRET or secret != _RESET_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    now = datetime.now(timezone.utc)
    db.query(UserCameraStats).update(
        {"weekly_count": 0, "week_start": now},
        synchronize_session=False,
    )
    db.commit()
    return {"message": "Weekly camera counts reset", "reset_at": now.isoformat()}
