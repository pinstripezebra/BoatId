from sqlalchemy import Column, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from utils.database import Base


class UserCameraStats(Base):
    __tablename__ = "user_camera_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    weekly_count = Column(Integer, nullable=False, default=0)
    week_start = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<UserCameraStats(user_id={self.user_id}, weekly_count={self.weekly_count})>"
