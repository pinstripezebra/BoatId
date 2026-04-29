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
# Note: cars.csv is no longer used as we're creating sample data directly

# Defining queries to create tables
users_table_creation_query = """CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_code VARCHAR(6),
    verification_code_expires_at TIMESTAMP WITH TIME ZONE,
    reset_code VARCHAR(6),
    reset_code_expires_at TIMESTAMP WITH TIME ZONE,
    role VARCHAR(20) NOT NULL,
    user_type VARCHAR(20) NOT NULL DEFAULT 'premium',
    location VARCHAR(255),
    phone_number VARCHAR(20),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
    """

car_identifications_table_creation_query = """CREATE TABLE IF NOT EXISTS car_identifications (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    image_filename VARCHAR(255) NOT NULL,
    s3_image_key VARCHAR(500) NOT NULL,
    is_car BOOLEAN NOT NULL,
    confidence VARCHAR(10),
    identification_data JSON NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    car_type VARCHAR(50),
    year_estimate VARCHAR(20),
    car_rarity VARCHAR(20),
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

car_popularity_table_creation_query = """CREATE TABLE IF NOT EXISTS car_popularity (
    id INTEGER PRIMARY KEY REFERENCES car_identifications(id),
    likes INTEGER NOT NULL DEFAULT 0
    )"""

liked_cars_table_creation_query = """CREATE TABLE IF NOT EXISTS liked_cars (
    id SERIAL PRIMARY KEY,
    car_id INTEGER NOT NULL REFERENCES car_identifications(id),
    user_id UUID NOT NULL REFERENCES users(id),
    CONSTRAINT uq_liked_car_user UNIQUE (car_id, user_id)
    )"""

car_details_table_creation_query = """CREATE TABLE IF NOT EXISTS car_details (
    id SERIAL PRIMARY KEY,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    car_class VARCHAR(100),
    cylinders INTEGER,
    displacement DOUBLE PRECISION,
    drive VARCHAR(20),
    fuel_type VARCHAR(20),
    transmission VARCHAR(10),
    city_mpg VARCHAR(50),
    highway_mpg VARCHAR(50),
    combination_mpg VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_car_details_make_model UNIQUE (make, model)
    )"""

user_camera_stats_table_creation_query = """CREATE TABLE IF NOT EXISTS user_camera_stats (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weekly_count INTEGER NOT NULL DEFAULT 0,
    week_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_camera_stats_user UNIQUE (user_id)
    )"""

# Deleting tables if they already exist (including old boat-named tables from before rename)
engine.delete_table('liked_boats')
engine.delete_table('boat_popularity')
engine.delete_table('boat_identifications')
engine.delete_table('user_camera_stats')
engine.delete_table('car_details')
engine.delete_table('liked_cars')
engine.delete_table('car_popularity')
engine.delete_table('refresh_tokens')
engine.delete_table('car_identifications')
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

    'description': 'Administrator user for CarId system'
}])

# Concatenate admin user with existing users
users = pd.concat([users, admin_user], ignore_index=True)

# Ensuring each row of users dataframe has a unique ID
if 'id' not in users.columns:
    users['id'] = [str(uuid.uuid4()) for _ in range(len(users))]


# Create tables
engine.create_table(users_table_creation_query)
engine.create_table(car_identifications_table_creation_query)
engine.create_table(car_details_table_creation_query)
engine.create_table(refresh_tokens_table_creation_query)
engine.create_table(car_popularity_table_creation_query)
engine.create_table(liked_cars_table_creation_query)
engine.create_table(user_camera_stats_table_creation_query)

# Create indexes for better performance using individual calls
index_queries = [
    "CREATE INDEX IF NOT EXISTS idx_car_make_model ON car_identifications (make, model);",
    "CREATE INDEX IF NOT EXISTS idx_car_type_confidence ON car_identifications (car_type, confidence);",
    "CREATE INDEX IF NOT EXISTS idx_created_car ON car_identifications (created_at, is_car);",
    "CREATE INDEX IF NOT EXISTS idx_is_car ON car_identifications (is_car);",
    "CREATE INDEX IF NOT EXISTS idx_confidence ON car_identifications (confidence);",
    "CREATE INDEX IF NOT EXISTS idx_make ON car_identifications (make);",
    "CREATE INDEX IF NOT EXISTS idx_model ON car_identifications (model);",
    "CREATE INDEX IF NOT EXISTS idx_car_type ON car_identifications (car_type);",
    "CREATE INDEX IF NOT EXISTS idx_refresh_token_user_id ON refresh_tokens (user_id);",
    "CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_tokens (token_hash);",
    "CREATE INDEX IF NOT EXISTS idx_car_location ON car_identifications (latitude, longitude);",
    "CREATE INDEX IF NOT EXISTS idx_liked_cars_user_id ON liked_cars (user_id);",
    "CREATE INDEX IF NOT EXISTS idx_liked_cars_car_id ON liked_cars (car_id);",
    "CREATE INDEX IF NOT EXISTS idx_car_search_vector ON car_identifications USING GIN (search_vector);",
]

for index_query in index_queries:
    try:
        engine.create_table(index_query)  # Reusing create_table method for index creation
    except Exception as e:
        print(f"Warning: Could not create index: {e}")

# Create trigger to auto-populate search_vector on insert/update
search_vector_trigger_func = """
CREATE OR REPLACE FUNCTION car_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.make, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.model, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.car_type, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.identification_data::json->>'description', '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

search_vector_trigger = """
DROP TRIGGER IF EXISTS trg_car_search_vector ON car_identifications;
CREATE TRIGGER trg_car_search_vector
    BEFORE INSERT OR UPDATE ON car_identifications
    FOR EACH ROW EXECUTE FUNCTION car_search_vector_update();
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
import asyncio
import json
import glob
from image_identification import AnthropicCarIdentifier

# US city coordinate ranges for realistic test data
city_locations = [
    (34.05, -118.24),  # Los Angeles, CA
    (40.71, -74.01),   # New York, NY
    (41.88, -87.63),   # Chicago, IL
    (29.76, -95.37),   # Houston, TX
    (33.45, -112.07),  # Phoenix, AZ
    (39.74, -104.99),  # Denver, CO
    (47.61, -122.34),  # Seattle, WA
    (25.76, -80.19),   # Miami, FL
    (42.36, -71.06),   # Boston, MA
    (38.91, -77.04),   # Washington, DC
    (37.77, -122.42),  # San Francisco, CA
    (32.72, -117.16),  # San Diego, CA
    (36.17, -115.14),  # Las Vegas, NV
    (30.27, -97.74),   # Austin, TX
    (35.23, -80.84),   # Charlotte, NC
    (45.52, -122.68),  # Portland, OR
    (39.95, -75.17),   # Philadelphia, PA
    (44.98, -93.27),   # Minneapolis, MN
    (35.47, -97.52),   # Oklahoma City, OK
    (36.16, -86.78),   # Nashville, TN
]

def random_city_coord():
    base_lat, base_lng = random.choice(city_locations)
    return round(base_lat + random.uniform(-0.1, 0.1), 6), round(base_lng + random.uniform(-0.1, 0.1), 6)

# --- Identification cache ---
# Cache file stores AI identification results so we don't re-call the API for
# images that have already been identified. Keyed by filename.
CACHE_FILE = os.path.join(current_file_dir, '.identification_cache.json')

def load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_cache(cache: dict):
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f, indent=2)

# Initialize the car identifier with Anthropic API
api_key = os.environ.get("ANTHROPIC_API_KEY")
if not api_key:
    print("ERROR: ANTHROPIC_API_KEY not set. Cannot identify car images.")
    exit(1)

identifier = AnthropicCarIdentifier(api_key=api_key)
requested_fields = ['make', 'model', 'description', 'car_type', 'year', 'body_type', 'features']

# Find all car images sorted numerically
images_dir = os.path.join(project_root, 'data', 'images')
image_files = sorted(
    glob.glob(os.path.join(images_dir, 'car*.png')),
    key=lambda x: int(os.path.basename(x).replace('car', '').replace('.png', ''))
)
print(f"\nFound {len(image_files)} car images to process...")

cache = load_cache()
cached_count = sum(1 for f in image_files if os.path.basename(f) in cache)
print(f"  {cached_count} already identified (cached), {len(image_files) - cached_count} need API calls")

async def identify_all_images():
    """Send each image through the AI identification pipeline, using cache when available."""
    results = []
    for img_path in image_files:
        filename = os.path.basename(img_path)
        s3_key = f"car-images/{filename}"
        lat, lng = random_city_coord()

        # Check cache first
        if filename in cache:
            cached = cache[filename]
            print(f"  {filename}: CACHED - {cached.get('make', '?')} {cached.get('model', '?')}")
            results.append({
                'image_filename': filename,
                's3_image_key': s3_key,
                'is_car': cached.get('is_car', True),
                'confidence': cached.get('confidence', 'low'),
                'identification_data': json.dumps(cached.get('identification_data', {})),
                'make': cached.get('make'),
                'model': cached.get('model'),
                'car_type': cached.get('car_type'),
                'year_estimate': cached.get('year'),
                'latitude': lat,
                'longitude': lng,
            })
            continue

        print(f"  Identifying {filename}...", end=" ")
        try:
            with open(img_path, 'rb') as f:
                image_data = f.read()

            result = await identifier.identify_car(image_data, requested_fields)

            # Build identification_data JSON from the full result
            id_data = {
                'make': result.make,
                'model': result.model,
                'description': result.description,
                'car_type': result.car_type,
                'confidence': result.confidence,
                'features': result.features or [],
                'year': result.year,
                'body_type': result.body_type,
            }

            # Save to cache
            cache[filename] = {
                'is_car': result.is_car,
                'confidence': result.confidence,
                'make': result.make,
                'model': result.model,
                'car_type': result.car_type,
                'year': result.year,
                'identification_data': id_data,
            }
            save_cache(cache)

            results.append({
                'image_filename': filename,
                's3_image_key': s3_key,
                'is_car': result.is_car,
                'confidence': result.confidence or 'low',
                'identification_data': json.dumps(id_data),
                'make': result.make,
                'model': result.model,
                'car_type': result.car_type,
                'year_estimate': result.year,
                'latitude': lat,
                'longitude': lng,
            })
            print(f"{result.make} {result.model} ({result.car_type}, {result.confidence})")

        except Exception as e:
            print(f"ERROR: {e}")
            results.append({
                'image_filename': filename,
                's3_image_key': s3_key,
                'is_car': False,
                'confidence': 'low',
                'identification_data': json.dumps({'error': str(e)}),
                'make': None,
                'model': None,
                'car_type': None,
                'year_estimate': None,
                'latitude': lat,
                'longitude': lng,
            })

    return results

# Run identification on all images (uses cache for previously identified)
car_results = asyncio.run(identify_all_images())
sample_car_data = pd.DataFrame(car_results)
print(f"\nSuccessfully processed {len(sample_car_data)} images")

# Populate car_identifications table
# Assign each car to a random user from the CSV users
csv_user_ids = users['id'].tolist()[:10]  # First 10 are CSV users, admin is last
sample_car_data['user_id'] = [random.choice(csv_user_ids) for _ in range(len(sample_car_data))]
engine.populate_table_dynamic(sample_car_data, 'car_identifications')

# Seed liked_cars: each user likes between 1-5 random cars
num_cars = len(sample_car_data)
car_ids = list(range(1, num_cars + 1))  # SERIAL IDs start at 1

liked_rows = []
for user_id in csv_user_ids:
    num_likes = random.randint(1, min(5, num_cars))
    liked_car_ids = random.sample(car_ids, num_likes)
    for cid in liked_car_ids:
        liked_rows.append({'car_id': cid, 'user_id': user_id})

liked_cars_df = pd.DataFrame(liked_rows)
engine.populate_table_dynamic(liked_cars_df, 'liked_cars')
print(f"Seeded {len(liked_rows)} likes across {len(csv_user_ids)} users")

# Populate car_popularity by aggregating likes from liked_cars
populate_popularity_query = """
INSERT INTO car_popularity (id, likes)
SELECT ci.id, COALESCE(lc.like_count, 0)
FROM car_identifications ci
LEFT JOIN (
    SELECT car_id, COUNT(*) as like_count
    FROM liked_cars
    GROUP BY car_id
) lc ON ci.id = lc.car_id
"""
try:
    engine.create_table(populate_popularity_query)
    print("Successfully populated car_popularity table from liked_cars aggregation")
except Exception as e:
    print(f"Error populating car_popularity: {e}")

# Backfill car_details for each distinct (make, model) pair in seeded car_identifications
import requests as _requests

_api_ninjas_key = os.getenv('CAR_API_KEY', '')
_CAR_DETAILS_CACHE = os.path.join(current_file_dir, '.car_details_cache.json')

def _load_car_details_cache() -> dict:
    if os.path.exists(_CAR_DETAILS_CACHE):
        with open(_CAR_DETAILS_CACHE, 'r') as _f:
            return json.load(_f)
    return {}

def _save_car_details_cache(cache: dict):
    with open(_CAR_DETAILS_CACHE, 'w') as _f:
        json.dump(cache, _f, indent=2)

_details_cache = _load_car_details_cache()

distinct_pairs = (
    sample_car_data[['make', 'model']]
    .dropna()
    .drop_duplicates()
    .values.tolist()
)
print(f"\nBackfilling car_details for {len(distinct_pairs)} distinct make/model pairs...")

_inserted = 0
for _make, _model in distinct_pairs:
    _key = f"{_make}|{_model}"
    if _key in _details_cache:
        _row = _details_cache[_key]
    elif not _api_ninjas_key:
        print(f"  Skipping {_make} {_model} — CAR_API_KEY not set")
        _row = {}
    else:
        try:
            _resp = _requests.get(
                'https://api.api-ninjas.com/v1/cars',
                params={'make': _make, 'model': _model},
                headers={'X-Api-Key': _api_ninjas_key},
                timeout=10,
            )
            _data = _resp.json() if _resp.ok else []
            _row = _data[0] if isinstance(_data, list) and _data else {}
            _details_cache[_key] = _row
            _save_car_details_cache(_details_cache)
            print(f"  {_make} {_model}: {'found' if _row else 'no data'}")
        except Exception as _e:
            print(f"  {_make} {_model}: API error — {_e}")
            _row = {}

    try:
        _cursor = engine.conn.cursor()
        _cursor.execute(
            "INSERT INTO car_details (make, model, car_class, cylinders, displacement, drive, fuel_type, transmission, city_mpg, highway_mpg, combination_mpg)"
            " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
            " ON CONFLICT (make, model) DO NOTHING",
            (
                str(_make), str(_model),
                _row.get('class'), _row.get('cylinders'), _row.get('displacement'),
                _row.get('drive'), _row.get('fuel_type'), _row.get('transmission'),
                str(_row.get('city_mpg', '')) if _row.get('city_mpg') is not None else None,
                str(_row.get('highway_mpg', '')) if _row.get('highway_mpg') is not None else None,
                str(_row.get('combination_mpg', '')) if _row.get('combination_mpg') is not None else None,
            )
        )
        engine.conn.commit()
        _cursor.close()
        _inserted += 1
    except Exception as _e:
        print(f"  Warning: could not insert car_details for {_make} {_model}: {_e}")

print(f"car_details backfill complete: {_inserted}/{len(distinct_pairs)} rows inserted")

# Testing if the tables were created and populated correctly
print(engine.test_table('users'))
print(engine.test_table('car_identifications'))
print(engine.test_table('car_details'))
print(engine.test_table('liked_cars'))
print(engine.test_table('car_popularity'))