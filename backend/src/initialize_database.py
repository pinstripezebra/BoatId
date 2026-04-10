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
    user_id UUID REFERENCES users(id),
    image_filename VARCHAR(255) NOT NULL,
    s3_image_key VARCHAR(500) NOT NULL,
    is_boat BOOLEAN NOT NULL,
    confidence VARCHAR(10),
    identification_data JSON NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    boat_type VARCHAR(50),
    year_estimate VARCHAR(20),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    search_vector TSVECTOR
    )"""

refresh_tokens_table_creation_query = """CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN NOT NULL DEFAULT FALSE
    )"""

boat_popularity_table_creation_query = """CREATE TABLE IF NOT EXISTS boat_popularity (
    id INTEGER PRIMARY KEY REFERENCES boat_identifications(id),
    likes INTEGER NOT NULL DEFAULT 0
    )"""

liked_boats_table_creation_query = """CREATE TABLE IF NOT EXISTS liked_boats (
    id SERIAL PRIMARY KEY,
    boat_id INTEGER NOT NULL REFERENCES boat_identifications(id),
    user_id UUID NOT NULL REFERENCES users(id),
    CONSTRAINT uq_liked_boat_user UNIQUE (boat_id, user_id)
    )"""

# Deleting tables if they already exist
engine.delete_table('liked_boats')
engine.delete_table('boat_popularity')
engine.delete_table('refresh_tokens')
engine.delete_table('boat_identifications')
engine.delete_table('users')

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
engine.create_table(refresh_tokens_table_creation_query)
engine.create_table(boat_popularity_table_creation_query)
engine.create_table(liked_boats_table_creation_query)

# Create indexes for better performance using individual calls
index_queries = [
    "CREATE INDEX IF NOT EXISTS idx_boat_make_model ON boat_identifications (make, model);",
    "CREATE INDEX IF NOT EXISTS idx_boat_type_confidence ON boat_identifications (boat_type, confidence);",
    "CREATE INDEX IF NOT EXISTS idx_created_boat ON boat_identifications (created_at, is_boat);",
    "CREATE INDEX IF NOT EXISTS idx_is_boat ON boat_identifications (is_boat);",
    "CREATE INDEX IF NOT EXISTS idx_confidence ON boat_identifications (confidence);",
    "CREATE INDEX IF NOT EXISTS idx_make ON boat_identifications (make);",
    "CREATE INDEX IF NOT EXISTS idx_model ON boat_identifications (model);",
    "CREATE INDEX IF NOT EXISTS idx_boat_type ON boat_identifications (boat_type);",
    "CREATE INDEX IF NOT EXISTS idx_refresh_token_user_id ON refresh_tokens (user_id);",
    "CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_tokens (token_hash);",
    "CREATE INDEX IF NOT EXISTS idx_boat_location ON boat_identifications (latitude, longitude);",
    "CREATE INDEX IF NOT EXISTS idx_liked_boats_user_id ON liked_boats (user_id);",
    "CREATE INDEX IF NOT EXISTS idx_liked_boats_boat_id ON liked_boats (boat_id);",
    "CREATE INDEX IF NOT EXISTS idx_boat_search_vector ON boat_identifications USING GIN (search_vector);",
]

for index_query in index_queries:
    try:
        engine.create_table(index_query)  # Reusing create_table method for index creation
    except Exception as e:
        print(f"Warning: Could not create index: {e}")

# Create trigger to auto-populate search_vector on insert/update
search_vector_trigger_func = """
CREATE OR REPLACE FUNCTION boat_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.make, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.model, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.boat_type, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.identification_data::json->>'description', '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

search_vector_trigger = """
DROP TRIGGER IF EXISTS trg_boat_search_vector ON boat_identifications;
CREATE TRIGGER trg_boat_search_vector
    BEFORE INSERT OR UPDATE ON boat_identifications
    FOR EACH ROW EXECUTE FUNCTION boat_search_vector_update();
"""

try:
    engine.create_table(search_vector_trigger_func)
    engine.create_table(search_vector_trigger)
    print("Successfully created search_vector trigger")
except Exception as e:
    print(f"Warning: Could not create search_vector trigger: {e}")

# Populate users table
engine.populate_table_dynamic(users, 'users')

import random

# Coastal US coordinate ranges for realistic test data
coastal_locations = [
    (25.76, -80.19),   # Miami, FL
    (32.71, -117.16),  # San Diego, CA
    (37.00, -76.00),   # Chesapeake Bay, VA
    (27.77, -82.64),   # Tampa Bay, FL
    (30.33, -81.66),   # Jacksonville, FL
    (29.95, -90.07),   # New Orleans, LA
    (33.77, -118.19),  # Long Beach, CA
    (47.61, -122.34),  # Seattle, WA
]

def random_coastal_coord():
    base_lat, base_lng = random.choice(coastal_locations)
    return round(base_lat + random.uniform(-0.1, 0.1), 6), round(base_lng + random.uniform(-0.1, 0.1), 6)

lat1, lng1 = random_coastal_coord()
lat2, lng2 = random_coastal_coord()
lat3, lng3 = random_coastal_coord()
lat4, lng4 = random_coastal_coord()
lat5, lng5 = random_coastal_coord()

# West coast specific locations for boats 6-15
west_coast_locations = [
    (48.54, -123.02),  # San Juan Islands, WA
    (47.65, -122.45),  # Puget Sound, WA
    (45.60, -123.96),  # Oregon Coast
    (43.35, -124.22),  # Coos Bay, OR
    (40.80, -124.16),  # Humboldt Bay, CA
    (37.82, -122.48),  # San Francisco Bay, CA
    (36.62, -121.90),  # Monterey Bay, CA
    (34.41, -119.69),  # Santa Barbara, CA
    (33.86, -118.40),  # Marina del Rey, CA
    (32.72, -117.17),  # San Diego Bay, CA
]

def west_coast_coord(idx):
    base_lat, base_lng = west_coast_locations[idx]
    return round(base_lat + random.uniform(-0.05, 0.05), 6), round(base_lng + random.uniform(-0.05, 0.05), 6)

wc_coords = [west_coast_coord(i) for i in range(10)]

# Create sample boat identification data using actual images uploaded to S3
sample_boat_data = pd.DataFrame([
    {
        'image_filename': 'boat1.png',
        's3_image_key': 'boat-images/boat1.png',
        'is_boat': True,
        'confidence': 'high',
        'identification_data': '{"make": "Beneteau", "model": "Oceanis 40.1", "description": "White fiberglass sailboat with blue trim", "boat_type": "sailboat", "confidence": "high", "length": "40", "features": ["roller furling", "wheel steering", "bimini top"]}',
        'make': 'Beneteau',
        'model': 'Oceanis 40.1',
        'boat_type': 'sailboat',
        'year_estimate': '2020',
        'latitude': lat1,
        'longitude': lng1
    },
    {
        'image_filename': 'boat2.png',
        's3_image_key': 'boat-images/boat2.png',
        'is_boat': True,
        'confidence': 'medium',
        'identification_data': '{"make": "Sea Ray", "model": "Sundancer 350", "description": "White powerboat with hardtop", "boat_type": "motorboat", "confidence": "medium", "length": "35", "features": ["hardtop", "outriggers"]}',
        'make': 'Sea Ray',
        'model': 'Sundancer 350',
        'boat_type': 'motorboat',
        'year_estimate': '2019',
        'latitude': lat2,
        'longitude': lng2
    },
    {
        'image_filename': 'boat3.png',
        's3_image_key': 'boat-images/boat3.png',
        'is_boat': True,
        'confidence': 'high',
        'identification_data': '{"make": "Boston Whaler", "model": "Montauk 170", "description": "Classic center console fishing boat", "boat_type": "fishing boat", "confidence": "high", "length": "17", "features": ["center console", "rod holders", "live well"]}',
        'make': 'Boston Whaler',
        'model': 'Montauk 170',
        'boat_type': 'fishing boat',
        'year_estimate': '2021',
        'latitude': lat3,
        'longitude': lng3
    },
    {
        'image_filename': 'boat4.png',
        's3_image_key': 'boat-images/boat4.png',
        'is_boat': True,
        'confidence': 'high',
        'identification_data': '{"make": "Yamaha", "model": "252S", "description": "Sport jet boat with twin engines", "boat_type": "jet boat", "confidence": "high", "length": "25", "features": ["twin jet drives", "wakeboard tower", "swim platform"]}',
        'make': 'Yamaha',
        'model': '252S',
        'boat_type': 'jet boat',
        'year_estimate': '2022',
        'latitude': lat4,
        'longitude': lng4
    },
    {
        'image_filename': 'boat5.png',
        's3_image_key': 'boat-images/boat5.png',
        'is_boat': True,
        'confidence': 'medium',
        'identification_data': '{"make": "Mastercraft", "model": "X24", "description": "Premium wakeboard and surf boat", "boat_type": "wakeboard boat", "confidence": "medium", "length": "24", "features": ["surf system", "tower speakers", "ballast tanks"]}',
        'make': 'Mastercraft',
        'model': 'X24',
        'boat_type': 'wakeboard boat',
        'year_estimate': '2023',
        'latitude': lat5,
        'longitude': lng5
    },
    {
        'image_filename': 'boat6.png',
        's3_image_key': 'boat-images/boat6.png',
        'is_boat': True,
        'confidence': 'high',
        'identification_data': '{"make": "Catalina", "model": "355", "description": "Classic cruising sailboat with roller furling", "boat_type": "sailboat", "confidence": "high", "length": "35", "features": ["roller furling", "dodger", "autopilot"]}',
        'make': 'Catalina',
        'model': '355',
        'boat_type': 'sailboat',
        'year_estimate': '2018',
        'latitude': wc_coords[0][0],
        'longitude': wc_coords[0][1]
    },
    {
        'image_filename': 'boat7.png',
        's3_image_key': 'boat-images/boat7.png',
        'is_boat': True,
        'confidence': 'high',
        'identification_data': '{"make": "Grady-White", "model": "Freedom 271", "description": "Dual console fishing boat with T-top", "boat_type": "fishing boat", "confidence": "high", "length": "27", "features": ["T-top", "live well", "rod holders", "fish boxes"]}',
        'make': 'Grady-White',
        'model': 'Freedom 271',
        'boat_type': 'fishing boat',
        'year_estimate': '2021',
        'latitude': wc_coords[1][0],
        'longitude': wc_coords[1][1]
    },
    {
        'image_filename': 'boat8.png',
        's3_image_key': 'boat-images/boat8.png',
        'is_boat': True,
        'confidence': 'medium',
        'identification_data': '{"make": "Chaparral", "model": "267 SSX", "description": "Sport bowrider with extended swim platform", "boat_type": "bowrider", "confidence": "medium", "length": "27", "features": ["swim platform", "wakeboard tower", "snap-in carpet"]}',
        'make': 'Chaparral',
        'model': '267 SSX',
        'boat_type': 'bowrider',
        'year_estimate': '2020',
        'latitude': wc_coords[2][0],
        'longitude': wc_coords[2][1]
    },
    {
        'image_filename': 'boat9.png',
        's3_image_key': 'boat-images/boat9.png',
        'is_boat': True,
        'confidence': 'high',
        'identification_data': '{"make": "Ranger", "model": "Z521L", "description": "High-performance bass fishing boat", "boat_type": "bass boat", "confidence": "high", "length": "21", "features": ["trolling motor", "fish finder", "rod storage", "live well"]}',
        'make': 'Ranger',
        'model': 'Z521L',
        'boat_type': 'bass boat',
        'year_estimate': '2022',
        'latitude': wc_coords[3][0],
        'longitude': wc_coords[3][1]
    },
    {
        'image_filename': 'boat10.png',
        's3_image_key': 'boat-images/boat10.png',
        'is_boat': True,
        'confidence': 'medium',
        'identification_data': '{"make": "Malibu", "model": "23 LSV", "description": "Wakeboard and surf boat with ballast system", "boat_type": "wakeboard boat", "confidence": "medium", "length": "23", "features": ["surf gate", "tower", "ballast system", "touchscreen dash"]}',
        'make': 'Malibu',
        'model': '23 LSV',
        'boat_type': 'wakeboard boat',
        'year_estimate': '2023',
        'latitude': wc_coords[4][0],
        'longitude': wc_coords[4][1]
    },
    {
        'image_filename': 'boat11.png',
        's3_image_key': 'boat-images/boat11.png',
        'is_boat': True,
        'confidence': 'high',
        'identification_data': '{"make": "Hatteras", "model": "GT54", "description": "Luxury sportfishing yacht with flybridge", "boat_type": "sportfish yacht", "confidence": "high", "length": "54", "features": ["flybridge", "fighting chair", "tuna tower", "air conditioning"]}',
        'make': 'Hatteras',
        'model': 'GT54',
        'boat_type': 'sportfish yacht',
        'year_estimate': '2019',
        'latitude': wc_coords[5][0],
        'longitude': wc_coords[5][1]
    },
    {
        'image_filename': 'boat12.png',
        's3_image_key': 'boat-images/boat12.png',
        'is_boat': True,
        'confidence': 'high',
        'identification_data': '{"make": "Hobie", "model": "Cat 16", "description": "Classic racing catamaran with colorful sails", "boat_type": "catamaran", "confidence": "high", "length": "16", "features": ["trampoline deck", "jib sail", "rotating mast"]}',
        'make': 'Hobie',
        'model': 'Cat 16',
        'boat_type': 'catamaran',
        'year_estimate': '2017',
        'latitude': wc_coords[6][0],
        'longitude': wc_coords[6][1]
    },
    {
        'image_filename': 'boat13.png',
        's3_image_key': 'boat-images/boat13.png',
        'is_boat': True,
        'confidence': 'medium',
        'identification_data': '{"make": "Chris-Craft", "model": "Launch 30", "description": "Heritage-style mahogany cruiser", "boat_type": "cruiser", "confidence": "medium", "length": "30", "features": ["teak swim platform", "heritage styling", "cabin berth"]}',
        'make': 'Chris-Craft',
        'model': 'Launch 30',
        'boat_type': 'cruiser',
        'year_estimate': '2021',
        'latitude': wc_coords[7][0],
        'longitude': wc_coords[7][1]
    },
    {
        'image_filename': 'boat14.png',
        's3_image_key': 'boat-images/boat14.png',
        'is_boat': True,
        'confidence': 'high',
        'identification_data': '{"make": "Fountain", "model": "38CC", "description": "Offshore center console with triple outboards", "boat_type": "center console", "confidence": "high", "length": "38", "features": ["triple outboards", "T-top", "leaning post", "insulated fish boxes"]}',
        'make': 'Fountain',
        'model': '38CC',
        'boat_type': 'center console',
        'year_estimate': '2020',
        'latitude': wc_coords[8][0],
        'longitude': wc_coords[8][1]
    },
    {
        'image_filename': 'boat15.png',
        's3_image_key': 'boat-images/boat15.png',
        'is_boat': True,
        'confidence': 'high',
        'identification_data': '{"make": "Sunseeker", "model": "Predator 50", "description": "Luxury performance motor yacht", "boat_type": "motor yacht", "confidence": "high", "length": "50", "features": ["hardtop", "bow sunpad", "hydraulic platform", "air conditioning"]}',
        'make': 'Sunseeker',
        'model': 'Predator 50',
        'boat_type': 'motor yacht',
        'year_estimate': '2022',
        'latitude': wc_coords[9][0],
        'longitude': wc_coords[9][1]
    }
])

# Populate boats table with sample data
engine.populate_table_dynamic(sample_boat_data, 'boat_identifications')

# Seed liked_boats for the 10 CSV users (not admin)
# Each user likes between 1-5 random boats from the 15 sample boats
csv_user_ids = users['id'].tolist()[:10]  # First 10 are CSV users, admin is last
boat_ids = list(range(1, 16))  # Boats have IDs 1-15 (SERIAL)

liked_rows = []
for user_id in csv_user_ids:
    num_likes = random.randint(1, 5)
    liked_boat_ids = random.sample(boat_ids, num_likes)
    for bid in liked_boat_ids:
        liked_rows.append({'boat_id': bid, 'user_id': user_id})

liked_boats_df = pd.DataFrame(liked_rows)
engine.populate_table_dynamic(liked_boats_df, 'liked_boats')

# Populate boat_popularity by aggregating likes directly from the database
# This ensures the counts match what's actually in liked_boats
populate_popularity_query = """
INSERT INTO boat_popularity (id, likes)
SELECT bi.id, COALESCE(lb.like_count, 0)
FROM boat_identifications bi
LEFT JOIN (
    SELECT boat_id, COUNT(*) as like_count
    FROM liked_boats
    GROUP BY boat_id
) lb ON bi.id = lb.boat_id
"""
try:
    engine.create_table(populate_popularity_query)
    print("Successfully populated boat_popularity table from liked_boats aggregation")
except Exception as e:
    print(f"Error populating boat_popularity: {e}")

# Testing if the tables were created and populated correctly
print(engine.test_table('users'))
print(engine.test_table('boat_identifications'))
print(engine.test_table('liked_boats'))
print(engine.test_table('boat_popularity'))