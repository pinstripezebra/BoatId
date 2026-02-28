from sqlalchemy import Column, String, Text, DateTime, Boolean, Index, Integer
from utils.database import Base  # ← Importing shared base from utils.database
from sqlalchemy.dialects.postgresql import JSON
from datetime import datetime

class BoatIdentification(Base):
    __tablename__ = "boat_identifications"
    
    id = Column(Integer, primary_key=True, index=True)
    image_filename = Column(String(255), nullable=False)
    s3_image_key = Column(String(500), nullable=False)  # S3 object key
    is_boat = Column(Boolean, nullable=False, index=True)
    confidence = Column(String(10), index=True)  # high/medium/low
    
    # Store the complete JSON response for flexibility
    identification_data = Column(JSON, nullable=False)
    
    # Extracted fields for fast queries (indexed)
    make = Column(String(100), index=True)
    model = Column(String(100), index=True)
    boat_type = Column(String(50), index=True)
    year_estimate = Column(String(20), index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Composite indexes for common queries
    __table_args__ = (
        Index('idx_boat_make_model', 'make', 'model'),
        Index('idx_boat_type_confidence', 'boat_type', 'confidence'),
        Index('idx_created_boat', 'created_at', 'is_boat'),
    )
    
    def __repr__(self):
        return f"<BoatIdentification(id={self.id}, make={self.make}, model={self.model}, is_boat={self.is_boat})>"