from sqlalchemy import Column, String, Text, DateTime, Numeric, func
from utils.database import Base  # ← Importing shared base from utils.database
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

class BoatIdentification(Base):
    __tablename__ = "boat_identifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(255), nullable=False)  # Reference to users table
    image_url = Column(String(500), nullable=False)
    image_s3_key = Column(String(500), nullable=False)
    make = Column(String(100))
    model = Column(String(100))
    boat_type = Column(String(50))
    dimensions = Column(JSONB)  # JSON field for boat dimensions
    description = Column(Text)
    confidence_score = Column(Numeric(3, 2))  # Decimal with 3 digits, 2 after decimal
    openai_response = Column(JSONB)  # JSON field for full OpenAI response
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<BoatIdentification(id={self.id}, make={self.make}, model={self.model})>"