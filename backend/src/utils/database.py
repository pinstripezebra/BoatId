from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
import os
import json
import boto3
import psycopg2
from dotenv import load_dotenv

load_dotenv()


def _load_db_config() -> dict:
    """Load DB connection config once at startup. Password is never stored — IAM token is used on AWS."""
    secret_name = os.getenv("DB_SECRET_NAME")
    if secret_name:
        region = os.getenv("AWS_REGION", "us-west-2")
        client = boto3.client("secretsmanager", region_name=region)
        secret = json.loads(client.get_secret_value(SecretId=secret_name)["SecretString"])
        return {
            "host": secret["host"],
            "port": int(secret["port"]),
            "user": secret["username"],
            "dbname": secret["dbname"],
            "use_iam": True,
        }
    # Local development: fall back to env vars with password auth
    return {
        "host": os.getenv("AWS_RDS_ENDPOINT"),
        "port": int(os.getenv("AWS_RDS_PORT", 5432)),
        "user": os.getenv("AWS_RDS_MASTER_USERNAME"),
        "dbname": os.getenv("AWS_RDS_DATABASE"),
        "password": os.getenv("AWS_RDS_PASSWORD"),
        "use_iam": False,
    }


_DB_CONFIG = _load_db_config()


def _create_iam_connection():
    """
    Create a psycopg2 connection using a fresh RDS IAM auth token.
    Called by SQLAlchemy each time a new physical connection is needed.
    Tokens expire after 15 min but existing pooled connections remain valid.
    """
    region = os.getenv("AWS_REGION", "us-west-2")
    token = boto3.client("rds", region_name=region).generate_db_auth_token(
        DBHostname=_DB_CONFIG["host"],
        Port=_DB_CONFIG["port"],
        DBUsername=_DB_CONFIG["user"],
        Region=region,
    )
    return psycopg2.connect(
        host=_DB_CONFIG["host"],
        port=_DB_CONFIG["port"],
        user=_DB_CONFIG["user"],
        password=token,
        dbname=_DB_CONFIG["dbname"],
        sslmode="require",
    )


# On AWS (DB_SECRET_NAME set): use IAM token auth — no stored password
# Locally: use password from env vars
if _DB_CONFIG["use_iam"]:
    engine = create_engine("postgresql+psycopg2://", creator=_create_iam_connection)
else:
    engine = create_engine(URL.create(
        drivername="postgresql",
        username=_DB_CONFIG["user"],
        password=_DB_CONFIG.get("password"),
        host=_DB_CONFIG["host"],
        port=_DB_CONFIG["port"],
        database=_DB_CONFIG["dbname"],
        query={"sslmode": "require"},
    ))

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