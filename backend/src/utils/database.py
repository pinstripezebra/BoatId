from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
import os
import json
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()


def _get_database_url() -> str:
    secret_name = os.getenv("DB_SECRET_NAME")
    if secret_name:
        client = boto3.client("secretsmanager", region_name=os.getenv("AWS_REGION", "us-west-2"))
        secret = json.loads(client.get_secret_value(SecretId=secret_name)["SecretString"])
        return (
            f"postgresql://{secret['username']}:{secret['password']}"
            f"@{secret['host']}:{secret['port']}/{secret['dbname']}"
        )
    # Fallback for local development without Secrets Manager
    return os.getenv(
        "DATABASE_URL",
        f"postgresql://{os.getenv('AWS_RDS_MASTER_USERNAME')}:{os.getenv('AWS_RDS_PASSWORD')}"
        f"@{os.getenv('AWS_RDS_ENDPOINT')}:{os.getenv('AWS_RDS_PORT')}/{os.getenv('AWS_RDS_DATABASE')}"
    )


DATABASE_URL = _get_database_url()

# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class for models
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    """
    Database dependency that provides a database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """
    Create all tables in the database.
    """
    from models.user import User
    from models.car import CarIdentification
    from models.car_popularity import CarPopularity
    from models.liked_car import LikedCar
    from models.car_details import CarDetails
    from models.user_camera_stats import UserCameraStats
    from models.badge import Badge
    from models.user_badge import UserBadge

    Base.metadata.create_all(bind=engine)