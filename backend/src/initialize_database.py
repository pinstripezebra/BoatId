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
# Note: boats.csv is no longer used as we're creating sample data directly

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
    id SERIAL PRIMARY KEY,
    image_filename VARCHAR(255) NOT NULL,
    s3_image_key VARCHAR(500) NOT NULL,
    is_boat BOOLEAN NOT NULL,
    confidence VARCHAR(10),
    identification_data JSON NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    boat_type VARCHAR(50),
    year_estimate VARCHAR(20),
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

# Ensuring each row of users dataframe has a unique ID
if 'id' not in users.columns:
    users['id'] = [str(uuid.uuid4()) for _ in range(len(users))]


# Create tables
engine.create_table(users_table_creation_query)
engine.create_table(boat_identifications_table_creation_query)

# Create indexes for better performance using individual calls
index_queries = [
    "CREATE INDEX IF NOT EXISTS idx_boat_make_model ON boat_identifications (make, model);",
    "CREATE INDEX IF NOT EXISTS idx_boat_type_confidence ON boat_identifications (boat_type, confidence);",
    "CREATE INDEX IF NOT EXISTS idx_created_boat ON boat_identifications (created_at, is_boat);",
    "CREATE INDEX IF NOT EXISTS idx_is_boat ON boat_identifications (is_boat);",
    "CREATE INDEX IF NOT EXISTS idx_confidence ON boat_identifications (confidence);",
    "CREATE INDEX IF NOT EXISTS idx_make ON boat_identifications (make);",
    "CREATE INDEX IF NOT EXISTS idx_model ON boat_identifications (model);",
    "CREATE INDEX IF NOT EXISTS idx_boat_type ON boat_identifications (boat_type);"
]

for index_query in index_queries:
    try:
        engine.create_table(index_query)  # Reusing create_table method for index creation
    except Exception as e:
        print(f"Warning: Could not create index: {e}")

# Populate users table
engine.populate_table_dynamic(users, 'users')

# Create sample boat identification data that matches new schema
sample_boat_data = pd.DataFrame([
    {
        'image_filename': 'sample_sailboat.jpg',
        's3_image_key': 'boat-images/2024/01/01/sample1.jpg',
        'is_boat': True,
        'confidence': 'high',
        'identification_data': '{"make": "Beneteau", "model": "Oceanis 40.1", "description": "White fiberglass sailboat with blue trim", "boat_type": "sailboat", "confidence": "high", "length": "40", "features": ["roller furling", "wheel steering", "bimini top"]}',
        'make': 'Beneteau',
        'model': 'Oceanis 40.1',
        'boat_type': 'sailboat',
        'year_estimate': '2020'
    },
    {
        'image_filename': 'sample_motorboat.jpg',
        's3_image_key': 'boat-images/2024/01/01/sample2.jpg',
        'is_boat': True,
        'confidence': 'medium',
        'identification_data': '{"make": "Sea Ray", "model": "unknown", "description": "White powerboat with hardtop", "boat_type": "motorboat", "confidence": "medium", "length": "30", "features": ["hardtop", "outriggers"]}',
        'make': 'Sea Ray',
        'model': None,
        'boat_type': 'motorboat',
        'year_estimate': 'unknown'
    },
    {
        'image_filename': 'not_a_boat.jpg',
        's3_image_key': 'boat-images/2024/01/01/sample3.jpg',
        'is_boat': False,
        'confidence': 'high',
        'identification_data': '{"is_boat": false, "confidence": "high", "description": "This appears to be a car, not a boat"}',
        'make': None,
        'model': None,
        'boat_type': None,
        'year_estimate': None
    }
])

# Populate boats table with sample data
engine.populate_table_dynamic(sample_boat_data, 'boat_identifications')

# Testing if the tables were created and populated correctly
print(engine.test_table('users'))
print(engine.test_table('boat_identifications'))