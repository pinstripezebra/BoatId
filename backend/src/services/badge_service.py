"""
badge_service.py
Checks whether a user has crossed any badge thresholds and awards badges permanently.
Call check_and_award_badges() after a successful car identification.
"""

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from models.badge import Badge
from models.car import CarIdentification
from models.user_badge import UserBadge


def check_and_award_badges(db: Session, user_id) -> list[int]:
    """
    Count the user's successful car identifications and award any newly-crossed badges.
    Badges are permanent — awarded with INSERT ... ON CONFLICT DO NOTHING.

    Returns a list of badge IDs that were just awarded (empty if none).
    """
    # Count user's captured cars
    car_count: int = (
        db.query(CarIdentification)
        .filter(
            CarIdentification.user_id == user_id,
            CarIdentification.is_car.is_(True),
        )
        .count()
    )

    # Fetch all badge thresholds that this user qualifies for
    eligible_badges = (
        db.query(Badge)
        .filter(Badge.required_images <= car_count)
        .all()
    )

    awarded: list[int] = []
    for badge in eligible_badges:
        # Insert only if not already earned (UNIQUE constraint on user_id, badge_id)
        stmt = (
            pg_insert(UserBadge)
            .values(user_id=user_id, badge_id=badge.id, car_count=car_count)
            .on_conflict_do_nothing(constraint="uq_user_badge")
        )
        result = db.execute(stmt)
        if result.rowcount:
            awarded.append(badge.id)

    if awarded:
        db.commit()

    return awarded
