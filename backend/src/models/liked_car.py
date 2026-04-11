from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from utils.database import Base


class LikedCar(Base):
    __tablename__ = "liked_cars"

    id = Column(Integer, primary_key=True, index=True)
    car_id = Column(Integer, ForeignKey('car_identifications.id'), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint('car_id', 'user_id', name='uq_liked_car_user'),
    )

    def __repr__(self):
        return f"<LikedCar(id={self.id}, car_id={self.car_id}, user_id={self.user_id})>"
