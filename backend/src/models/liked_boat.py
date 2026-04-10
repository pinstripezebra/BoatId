from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from utils.database import Base


class LikedBoat(Base):
    __tablename__ = "liked_boats"

    id = Column(Integer, primary_key=True, index=True)
    boat_id = Column(Integer, ForeignKey('boat_identifications.id'), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint('boat_id', 'user_id', name='uq_liked_boat_user'),
    )

    def __repr__(self):
        return f"<LikedBoat(id={self.id}, boat_id={self.boat_id}, user_id={self.user_id})>"
