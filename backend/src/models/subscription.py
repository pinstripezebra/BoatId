from sqlalchemy import Column, String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from utils.database import Base
import uuid


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    revenuecat_customer_id = Column(String(255), nullable=True)
    # status: active | trial | expired | inactive
    status = Column(String(20), nullable=False, default="inactive")
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    period_ends_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<Subscription(user_id={self.user_id}, status={self.status})>"
