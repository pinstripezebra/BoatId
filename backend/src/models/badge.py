from sqlalchemy import Column, Integer, String
from utils.database import Base


class Badge(Base):
    __tablename__ = "badges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)          # e.g. "1 Star"
    required_images = Column(Integer, nullable=False)   # threshold: 1, 5, 10, 20
    s3_key = Column(String(500), nullable=True)         # S3 object key for the badge image

    def __repr__(self):
        return f"<Badge(id={self.id}, name={self.name!r}, required_images={self.required_images})>"
