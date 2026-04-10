from sqlalchemy import Column, Integer, ForeignKey
from utils.database import Base


class BoatPopularity(Base):
    __tablename__ = "boat_popularity"

    id = Column(Integer, ForeignKey('boat_identifications.id'), primary_key=True)
    likes = Column(Integer, nullable=False, default=0)

    def __repr__(self):
        return f"<BoatPopularity(id={self.id}, likes={self.likes})>"
