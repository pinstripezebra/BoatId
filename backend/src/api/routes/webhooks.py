import os
import logging
import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from models.user import User
from models.subscription import Subscription
from utils.database import get_db

router = APIRouter()
logger = logging.getLogger("carid.security")

REVENUECAT_WEBHOOK_SECRET = os.getenv("REVENUECAT_WEBHOOK_SECRET")

# Events that indicate an active premium entitlement
ACTIVE_EVENTS = {
    "INITIAL_PURCHASE",
    "RENEWAL",
    "TRIAL_STARTED",
    "TRIAL_CONVERTED",
    "UNCANCELLATION",
}

# Events that indicate the subscription has ended
INACTIVE_EVENTS = {
    "CANCELLATION",
    "EXPIRATION",
    "TRIAL_CANCELLED",
}


@router.post("/revenuecat", status_code=200)
async def revenuecat_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle RevenueCat webhook events to sync user subscription status."""

    # Validate webhook secret — RevenueCat sends it as the Authorization header value
    auth_header = request.headers.get("Authorization")
    if not REVENUECAT_WEBHOOK_SECRET or auth_header != REVENUECAT_WEBHOOK_SECRET:
        logger.warning("Rejected RevenueCat webhook: invalid Authorization header")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON")

    event = body.get("event", {})
    event_type = event.get("type")
    app_user_id = event.get("app_user_id")
    rc_customer_id = event.get("original_app_user_id") or app_user_id

    if not event_type or not app_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing event type or app_user_id",
        )

    # Parse app_user_id as UUID (we use user.id as RevenueCat's appUserID)
    try:
        user_uuid = uuid_lib.UUID(str(app_user_id))
    except ValueError:
        logger.warning("RevenueCat webhook: unrecognised app_user_id format: %s", app_user_id)
        # Return 200 so RevenueCat does not retry for non-UUID app_user_ids
        return {"status": "ignored"}

    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        logger.warning("RevenueCat webhook: user not found for app_user_id: %s", app_user_id)
        return {"status": "ignored"}

    # Determine new subscription state
    if event_type in ACTIVE_EVENTS:
        new_user_type = "premium"
        sub_status = "trial" if event_type == "TRIAL_STARTED" else "active"
    elif event_type in INACTIVE_EVENTS:
        new_user_type = "basic"
        sub_status = "expired"
    else:
        # Unhandled event — acknowledge without making changes
        return {"status": "ignored"}

    # Update user type
    user.user_type = new_user_type

    # Upsert subscription record
    subscription = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    if subscription:
        subscription.status = sub_status
        subscription.revenuecat_customer_id = rc_customer_id
    else:
        subscription = Subscription(
            user_id=user.id,
            revenuecat_customer_id=rc_customer_id,
            status=sub_status,
        )
        db.add(subscription)

    db.commit()

    logger.info(
        "RevenueCat webhook processed: user=%s event=%s new_type=%s",
        user.id,
        event_type,
        new_user_type,
    )
    return {"status": "ok"}
