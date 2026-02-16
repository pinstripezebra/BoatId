from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
import os
from dotenv import load_dotenv
from utils.db_handler import DatabaseHandler
import pandas as pd
import uuid
import boto3
from botocore.exceptions import ClientError
from passlib.context import CryptContext

# Load environment variables from .env file (override=True reloads changed values)
load_dotenv(override=True)

# Get AWS RDS connection details from environment variables
master_username = os.environ.get("AWS_RDS_MASTER_USERNAME")
password = os.environ.get("AWS_RDS_PASSWORD")
rds_endpoint = os.environ.get('AWS_RDS_ENDPOINT')
rds_port = os.environ.get("AWS_RDS_PORT")
rds_database = os.environ.get("AWS_RDS_DATABASE")

# Construct PostgreSQL connection URL for RDS
URL_database = f"postgresql://{master_username}:{password}@{rds_endpoint}:{rds_port}/{rds_database}"

# Initialize DatabaseHandler with the constructed URL
engine = DatabaseHandler(URL_database)

# loading csv files into pandas dataframes
# Get the project root by going up from this file's location
current_file_dir = os.path.dirname(os.path.abspath(__file__))  # /back_end/src
back_end_dir = os.path.dirname(current_file_dir)  # /back_end
project_root = os.path.dirname(back_end_dir)  # /project_root

users = pd.read_csv(os.path.join(project_root, 'data', 'users.csv'))
boats = pd.read_csv(os.path.join(project_root, 'data', 'boats.csv'))

# Defining queries to create tables
users_table_creation_query = """CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    location VARCHAR(255),
    phone_number VARCHAR(20),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """

boat_identifications_table_creation_query = """CREATE TABLE IF NOT EXISTS boat_identifications (
    id UUID PRIMARY KEY,
    user_id VARCHAR(255),
    image_url VARCHAR(500) NOT NULL,
    image_s3_key VARCHAR(500) NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    boat_type VARCHAR(50),
    dimensions JSONB,
    description TEXT,
    confidence_score DECIMAL(3,2),
    openai_response JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )"""

# Deleting tables if they already exist
engine.delete_table('users')
engine.delete_table('boat_identifications')

# Initialize password context for hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password_safely(password: str) -> str:
    """Hash a password with bcrypt 72-byte limit handling."""
    # Truncate password to 72 bytes to comply with bcrypt limit
    if len(password.encode('utf-8')) > 72:
        password = password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
    return pwd_context.hash(password)

# Hash passwords for all users
users['password'] = users['password'].apply(hash_password_safely)

# Add an admin user for testing
admin_user = pd.DataFrame([{
    'username': os.getenv('ADMIN_USERNAME'),
    'password': hash_password_safely(os.getenv('ADMIN_PASSWORD')),
    'email': os.getenv('ADMIN_EMAIL'),
    'role': 'admin',
    'location': None,
    'phone_number': None,
    'description': 'Administrator user for BoatId system'
}])

# Concatenate admin user with existing users
users = pd.concat([users, admin_user], ignore_index=True)

# Ensuring each row of each dataframe has a unique ID
if 'id' not in users.columns:
    users['id'] = [str(uuid.uuid4()) for _ in range(len(users))]

if 'id' not in boats.columns:
    boats['id'] = [str(uuid.uuid4()) for _ in range(len(boats))]


# Create tables
engine.create_table(users_table_creation_query)
engine.create_table(boat_identifications_table_creation_query)

# Populates the tables with data from the dataframes
engine.populate_table_dynamic(users, 'users')
engine.populate_table_dynamic(boats, 'boat_identifications')

# Testing if the tables were created and populated correctly
print(engine.test_table('users'))
print(engine.test_table('boat_identifications'))