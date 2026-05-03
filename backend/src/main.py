from dotenv import load_dotenv
import os
import logging
import time
import uuid

# Load environment variables
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from utils.rate_limit import limiter
from utils.logging_config import configure_logging
from api.routes import auth, cars, users, images, car_id, car_statistics, camera_stats, badges

# Configure structured JSON logging before any loggers are created
configure_logging()

security_logger = logging.getLogger("carid.security")
access_logger = logging.getLogger("carid.access")

app = FastAPI(
    title="CarId API",
    description="Car identification service",
    version="1.0.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS – restrict to known origins in production
allowed_origins = os.getenv("CORS_ORIGINS", "https://api.boatid.org").split(",")
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
    security_logger.error(
        "Unhandled exception",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "method": request.method,
            "path": request.url.path,
        },
        exc_info=True,
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id

    access_logger.info(
        "request",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "query": str(request.url.query) or None,
            "content_length": request.headers.get("content-length"),
            "user_agent": request.headers.get("user-agent"),
            "ip": request.client.host if request.client else None,
            "authorization": "present" if request.headers.get("authorization") else "absent",
        },
    )

    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 1)

    log_level = logging.WARNING if response.status_code >= 400 else logging.INFO
    access_logger.log(
        log_level,
        "response",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )

    response.headers["X-Request-Id"] = request_id
    return response

app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(car_id.router, prefix="/api/v1/cars", tags=["car-identification"])
app.include_router(cars.router, prefix="/api/v1/cars", tags=["cars"])
app.include_router(car_statistics.router, prefix="/api/v1/car-statistics", tags=["car-statistics"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(images.router, prefix="/api/v1/images", tags=["images"])
app.include_router(camera_stats.router, prefix="/api/v1/camera-stats", tags=["camera-stats"])
app.include_router(badges.router, prefix="/api/v1/badges", tags=["badges"])

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