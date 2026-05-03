from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
import os
import json
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()


def _get_database_url() -> URL:
    secret_name = os.getenv("DB_SECRET_NAME")
    if secret_name:
        client = boto3.client("secretsmanager", region_name=os.getenv("AWS_REGION", "us-west-2"))
        secret = json.loads(client.get_secret_value(SecretId=secret_name)["SecretString"])
        return URL.create(
            drivername="postgresql",
            username=secret["username"],
            password=secret["password"],
            host=secret["host"],
            port=int(secret["port"]),
            database=secret["dbname"],
            query={"sslmode": "require"},
        )
    # Fallback for local development without Secrets Manager
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url
    return URL.create(
        drivername="postgresql",
        username=os.getenv("AWS_RDS_MASTER_USERNAME"),
        password=os.getenv("AWS_RDS_PASSWORD"),
        host=os.getenv("AWS_RDS_ENDPOINT"),
        port=int(os.getenv("AWS_RDS_PORT", 5432)),
        database=os.getenv("AWS_RDS_DATABASE"),
        query={"sslmode": "require"},
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