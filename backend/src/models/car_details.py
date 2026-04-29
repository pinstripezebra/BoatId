from sqlalchemy import Column, String, Integer, Float, DateTime, UniqueConstraint
from utils.database import Base
from datetime import datetime


class CarDetails(Base):
    __tablename__ = "car_details"

    id = Column(Integer, primary_key=True, index=True)
    make = Column(String(100), nullable=False, index=True)
    model = Column(String(100), nullable=False, index=True)

    # Fields from API-Ninjas /v1/cars response
    car_class = Column(String(100), nullable=True)
    cylinders = Column(Integer, nullable=True)
    displacement = Column(Float, nullable=True)
    drive = Column(String(20), nullable=True)       # fwd / rwd / awd / 4wd
    fuel_type = Column(String(20), nullable=True)   # gas / diesel / electricity
    transmission = Column(String(10), nullable=True)  # a (automatic) / m (manual)
    city_mpg = Column(String(50), nullable=True)    # may be "premium subscribers only"
    highway_mpg = Column(String(50), nullable=True)
    combination_mpg = Column(String(50), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('make', 'model', name='uq_car_details_make_model'),
    )

    def __repr__(self):
        return f"<CarDetails(make={self.make}, model={self.model})>"

    def to_dict(self) -> dict:
        return {
            "make": self.make,
            "model": self.model,
            "car_class": self.car_class,
            "cylinders": self.cylinders,
            "displacement": self.displacement,
            "drive": self.drive,
            "fuel_type": self.fuel_type,
            "transmission": self.transmission,
            "city_mpg": self.city_mpg,
            "highway_mpg": self.highway_mpg,
            "combination_mpg": self.combination_mpg,
        }
