from sqlalchemy import Column, Integer, ForeignKey
from utils.database import Base


class CarPopularity(Base):
    __tablename__ = "car_popularity"

    id = Column(Integer, ForeignKey('car_identifications.id'), primary_key=True)
    likes = Column(Integer, nullable=False, default=0)

    def __repr__(self):
        return f"<CarPopularity(id={self.id}, likes={self.likes})>"
