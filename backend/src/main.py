from dotenv import load_dotenv
import os
import logging

# Load environment variables
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from utils.rate_limit import limiter
from api.routes import auth, cars, users, images, car_id, car_statistics

# Security event logger
security_logger = logging.getLogger("carid.security")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

app = FastAPI(
    title="CarId API",
    description="Car identification service",
    version="1.0.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS – restrict to known origins in production
allowed_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler – prevent internal details from leaking
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    security_logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(car_id.router, prefix="/api/v1/cars", tags=["car-identification"])
app.include_router(cars.router, prefix="/api/v1/cars", tags=["cars"])
app.include_router(car_statistics.router, prefix="/api/v1/car-statistics", tags=["car-statistics"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(images.router, prefix="/api/v1/images", tags=["images"])

@app.on_event("startup")
async def on_startup():
    from utils.database import create_tables
    create_tables()


@app.get("/")
async def root():
    return {"message": "CarId API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "carid-backend"}

@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check including database connectivity"""
    from utils.database import SessionLocal
    from sqlalchemy import text
    import boto3
    
    health_status = {
        "status": "healthy",
        "service": "carid-backend",
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