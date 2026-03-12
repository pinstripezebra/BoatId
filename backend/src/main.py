from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import auth, boats, users

app = FastAPI(
    title="BoatId API",
    description="Boat identification service",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(boats.router, prefix="/api/v1/boats", tags=["boats"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])

@app.get("/")
async def root():
    return {"message": "BoatId API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "boatid-backend"}

@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check including database connectivity"""
    from utils.database import SessionLocal
    from sqlalchemy import text
    import boto3
    
    health_status = {
        "status": "healthy",
        "service": "boatid-backend",
        "timestamp": "2024-01-01T00:00:00Z",
        "checks": {}
    }
    
    # Database health check
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        health_status["checks"]["database"] = "healthy"
    except Exception as e:
        health_status["checks"]["database"] = "unhealthy"
        health_status["status"] = "degraded"
    
    # S3 health check
    try:
        s3_client = boto3.client('s3')
        bucket_name = os.getenv("AWS_BUCKET_NAME")
        s3_client.head_bucket(Bucket=bucket_name)
        health_status["checks"]["s3"] = "healthy"
    except Exception as e:
        health_status["checks"]["s3"] = "unhealthy"
        health_status["status"] = "degraded"
    
    # Anthropic API health check
    try:
        anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        if anthropic_key:
            health_status["checks"]["anthropic"] = "configured"
        else:
            health_status["checks"]["anthropic"] = "not_configured"
    except Exception as e:
        health_status["checks"]["anthropic"] = "error"
    
    return health_status