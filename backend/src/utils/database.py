from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
import os
from dotenv import load_dotenv

load_dotenv()

# Get database URL from environment variables
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://{os.getenv('AWS_RDS_MASTER_USERNAME')}:{os.getenv('AWS_RDS_PASSWORD')}@{os.getenv('AWS_RDS_ENDPOINT')}:{os.getenv('AWS_RDS_PORT')}/{os.getenv('AWS_RDS_DATABASE')}"
)

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
    from models.boat import BoatIdentification
    
    Base.metadata.create_all(bind=engine)