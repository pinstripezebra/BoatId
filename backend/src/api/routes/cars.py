from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, List, Dict, Any
import json
import os
import boto3
import io
from botocore.exceptions import ClientError, NoCredentialsError
from models.car import CarIdentification
from models.user import User
from models.car_popularity import CarPopularity
from models.liked_car import LikedCar
from services.storage_service import CarStorageService
from utils.database import get_db
from utils.rate_limit import limiter
from api.routes.users import get_current_user, get_current_user_optional
from dotenv import load_dotenv
from image_identification import AnthropicCarIdentifier, CarIdentificationResult


# Load environment variables
load_dotenv()

router = APIRouter()
security = HTTPBearer()

# Initialize S3 client
s3_client = boto3.client('s3', region_name=os.getenv('AWS_REGION', 'us-west-2'))
aws_bucket_name = os.getenv("AWS_BUCKET_NAME")
anthropic_key = os.getenv("ANTHROPIC_API_KEY")

# Dependency to get car identifier
def get_car_identifier():
    if not anthropic_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")
    return AnthropicCarIdentifier(api_key=anthropic_key)

@router.post("/identify")
@limiter.limit("20/minute")
async def identify_car_from_image(
    request: Request,
    image: UploadFile = File(..., description="Image file to analyze"),
    requested_fields: Optional[str] = Form(['make', 'model', 'description', 'year', 'length', 
                             'car_type', 'body_type', 'features'], description="Comma-separated list of fields to return"),
    store_results: bool = Form(True, description="Whether to store results in database"),
    latitude: Optional[float] = Form(None, description="Latitude of where the photo was taken"),
    longitude: Optional[float] = Form(None, description="Longitude of where the photo was taken"),
    identifier: AnthropicCarIdentifier = Depends(get_car_identifier),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Identify car details from an uploaded image using Anthropic's Claude Vision model.
    
    Returns structured information about the car including make, model, type, and other details.
    """
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png']
    if image.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Supported types: {', '.join(allowed_types)}"
        )
    
    # Validate file size (10MB limit)
    max_size = 10 * 1024 * 1024  # 10MB
    if image.size and image.size > max_size:
        raise HTTPException(
            status_code=400, 
            detail="File too large. Maximum size is 10MB."
        )
    
    try:
        # Read image data
        image_data = await image.read()
        
        # Parse requested fields
        fields = []
        if requested_fields:
            fields = [field.strip() for field in requested_fields.split(',') if field.strip()]
        
        # Identify car using Anthropic
        result = await identifier.identify_car(image_data, fields)
        
        # Store results if requested
        identification_id = None
        if store_results:
            storage_service = CarStorageService(
                db_session=db,
                s3_bucket=aws_bucket_name or "carid-images"
            )
            identification_id = await storage_service.store_identification_result(
                image_filename=image.filename or "car_image.jpg",
                image_data=image_data,
                result=result,
                user_id=current_user.id if current_user else None,
                latitude=latitude,
                longitude=longitude
            )
        
        # Build response
        response_data = {
            "success": True,
            "identification_id": identification_id,
            "filename": image.filename,
            "is_car": result.is_car
        }
        
        if result.is_car:
            # Add car details to response
            car_data = {}
            
            # Include all non-None fields
            for field_name in ['make', 'model', 'description', 'year', 'length', 
                             'car_type', 'body_type', 'features']:
                value = getattr(result, field_name)
                if value is not None:
                    # Only include if no specific fields requested or field was requested
                    if not fields or field_name in fields:
                        car_data[field_name] = value
            
            response_data.update({
                "car_details": car_data,
                "confidence": result.confidence
            })
                
        else:
            response_data.update({
                "message": "No car detected in the image",
                "confidence": result.confidence
            })
            if result.description:
                response_data["description"] = result.description
        
        return JSONResponse(content=response_data, status_code=200)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Unexpected error during identification")


# for uploading files to s3 bucket
@router.post("/upload", summary="Upload file to S3")
@limiter.limit("20/minute")
async def upload_file_to_s3(request: Request, file: UploadFile | None = None):
    if file is None:
        return {"error": "No file provided"}
    try:
        s3_client.upload_fileobj(file.file, aws_bucket_name, file.filename)
        return {"message": "File uploaded successfully"}
    except Exception as e:
        return {"error": str(e)}


def get_car_image_from_s3(car_id: str, db: Session) -> StreamingResponse:
    """
    Retrieve and stream car image from S3 based on car_id.
    Returns the actual image file.
    """
    try:
        # Get car information from database
        car = db.query(CarIdentification).filter(
            CarIdentification.id == int(car_id)
        ).first()
        
        if not car:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Car not found"
            )
        
        if not car.s3_image_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No image associated with this car"
            )
        
        if not aws_bucket_name:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="S3 configuration not found"
            )
        
        # Get image object from S3
        try:
            response = s3_client.get_object(Bucket=aws_bucket_name, Key=car.s3_image_key)
            image_content = response['Body'].read()
            content_type = response.get('ContentType', 'image/png')
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Image not found in S3"
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error accessing S3"
            )
        
        # Return image as streaming response
        return StreamingResponse(
            io.BytesIO(image_content),
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename=\"car_{car_id}_image.png\""
            }
        )
        
    except HTTPException:
        raise
    except NoCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AWS credentials not configured"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving car image"
        )

@router.get("/identifications")
async def get_car_identifications(
    page: int = 1,
    per_page: int = 50,
    is_car: Optional[bool] = None,
    make: Optional[str] = None,
    car_type: Optional[str] = None,
    confidence: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get paginated list of car identifications for the current user"""
    
    storage_service = CarStorageService(
        db_session=db,
        s3_bucket=aws_bucket_name or "carid-images"
    )
    
    offset = (page - 1) * per_page
    
    results = storage_service.get_identification_results(
        limit=per_page,
        offset=offset,
        is_car=is_car,
        make=make,
        car_type=car_type,
        confidence=confidence,
        user_id=current_user.id
    )
    
    return {
        **results,
        "page": page,
        "per_page": per_page,
        "total_pages": (results['total_count'] + per_page - 1) // per_page
    }

@router.get("/popular")
async def get_popular_cars(
    request: Request,
    limit: int = Query(5, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Get the most popular cars sorted by number of likes."""
    results = (
        db.query(CarIdentification, CarPopularity.likes)
        .join(CarPopularity, CarPopularity.id == CarIdentification.id)
        .filter(CarIdentification.is_car == True)
        .order_by(CarPopularity.likes.desc())
        .limit(limit)
        .all()
    )

    storage_service = CarStorageService(
        db_session=db,
        s3_bucket=aws_bucket_name or "carid-images",
    )

    cars = []
    for car, likes in results:
        try:
            image_url = storage_service.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': storage_service.bucket, 'Key': car.s3_image_key},
                ExpiresIn=3600,
            )
        except Exception:
            base_url = str(request.base_url).rstrip('/')
            image_url = f"{base_url}/api/v1/cars/identifications/{car.id}/image"

        cars.append({
            'id': car.id,
            'make': car.make,
            'model': car.model,
            'car_type': car.car_type,
            'year_estimate': car.year_estimate,
            'confidence': car.confidence,
            'image_url': image_url,
            'likes': likes,
            'identification_data': car.identification_data,
        })

    return {"results": cars, "count": len(cars)}


@router.get("/liked")
async def get_liked_car_ids(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get list of car IDs the current user has liked."""
    rows = db.query(LikedCar.car_id).filter(LikedCar.user_id == current_user.id).all()
    return {"liked_car_ids": [r[0] for r in rows]}


@router.get("/user-liked")
async def get_user_liked_cars(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(8, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get paginated car details for cars the current user has liked."""
    offset = (page - 1) * per_page

    total = db.query(LikedCar).filter(LikedCar.user_id == current_user.id).count()

    rows = (
        db.query(CarIdentification)
        .join(LikedCar, LikedCar.car_id == CarIdentification.id)
        .filter(LikedCar.user_id == current_user.id)
        .order_by(CarIdentification.created_at.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )

    storage_service = CarStorageService(
        db_session=db,
        s3_bucket=aws_bucket_name or "carid-images",
    )

    results = []
    for car in rows:
        try:
            image_url = storage_service.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': storage_service.bucket, 'Key': car.s3_image_key},
                ExpiresIn=3600,
            )
        except Exception:
            base_url = str(request.base_url).rstrip('/')
            image_url = f"{base_url}/api/v1/cars/identifications/{car.id}/image"

        results.append({
            'id': car.id,
            'make': car.make,
            'model': car.model,
            'car_type': car.car_type,
            'year_estimate': car.year_estimate,
            'confidence': car.confidence,
            'image_url': image_url,
            'identification_data': car.identification_data,
        })

    return {
        "results": results,
        "total_count": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.post("/{car_id}/like")
async def like_car(
    car_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Like a car. Returns 409 if already liked."""
    car = db.query(CarIdentification).filter(CarIdentification.id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    existing = (
        db.query(LikedCar)
        .filter(LikedCar.car_id == car_id, LikedCar.user_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already liked")

    db.add(LikedCar(car_id=car_id, user_id=current_user.id))

    popularity = db.query(CarPopularity).filter(CarPopularity.id == car_id).first()
    if popularity:
        popularity.likes += 1
    else:
        db.add(CarPopularity(id=car_id, likes=1))

    db.commit()
    return {"success": True, "car_id": car_id, "action": "liked"}


@router.delete("/{car_id}/like")
async def unlike_car(
    car_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unlike a car. Returns 404 if not currently liked."""
    existing = (
        db.query(LikedCar)
        .filter(LikedCar.car_id == car_id, LikedCar.user_id == current_user.id)
        .first()
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Not liked")

    db.delete(existing)

    popularity = db.query(CarPopularity).filter(CarPopularity.id == car_id).first()
    if popularity and popularity.likes > 0:
        popularity.likes -= 1

    db.commit()
    return {"success": True, "car_id": car_id, "action": "unliked"}


@router.get("/identifications/{identification_id}")
async def get_car_identification(
    identification_id: int,
    db: Session = Depends(get_db)
):
    """Get specific car identification by ID"""
    
    storage_service = CarStorageService(
        db_session=db,
        s3_bucket=aws_bucket_name or "carid-images"
    )
    
    result = storage_service.get_identification_by_id(identification_id)
    
    if not result:
        raise HTTPException(status_code=404, detail="Identification not found")
    
    return result

@router.get("/search")
async def search_cars(
    q: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(8, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Search car identifications using full-text search, sorted by popularity."""

    storage_service = CarStorageService(
        db_session=db,
        s3_bucket=aws_bucket_name or "carid-images"
    )

    offset = (page - 1) * per_page
    data = storage_service.search_cars(q, limit=per_page, offset=offset)

    # Get liked car IDs for current user
    liked_ids = set()
    if current_user:
        rows = db.query(LikedCar.car_id).filter(LikedCar.user_id == current_user.id).all()
        liked_ids = {r[0] for r in rows}

    # Add is_liked flag to each result
    for item in data['results']:
        item['is_liked'] = item['id'] in liked_ids

    total = data['total_count']
    return {
        "query": q,
        "results": data['results'],
        "total_count": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }

@router.get("/identification-fields")
async def get_available_identification_fields():
    """
    Get the list of available fields that can be requested for car identification.
    """
    return {
        "available_fields": [
            {
                "field": "make",
                "description": "Manufacturer or brand name",
                "example": "Toyota, Ford, BMW"
            },
            {
                "field": "model", 
                "description": "Specific model name",
                "example": "Camry, Mustang GT, 3 Series"
            },
            {
                "field": "description",
                "description": "Detailed physical description of the car",
                "example": "Red sports car with black racing stripes"
            },
            {
                "field": "year",
                "description": "Estimated year or year range",
                "example": "2015, 2010-2015, unknown"
            },
            {
                "field": "length",
                "description": "Estimated length in feet", 
                "example": "15, 16-18, unknown"
            },
            {
                "field": "car_type",
                "description": "Type or category of car",
                "example": "sedan, SUV, truck, sports car, coupe"
            },
            {
                "field": "body_type",
                "description": "Body style of the vehicle",
                "example": "hatchback, convertible, wagon"
            },
            {
                "field": "features",
                "description": "Notable features and equipment (array)",
                "example": ["sunroof", "alloy wheels", "roof rack"]
            }
        ]
    }

@router.get("/identifications/{identification_id}/image", response_class=StreamingResponse)
async def get_car_image(
    identification_id: int,
    db: Session = Depends(get_db)
):
    """
    Get the actual car image file from S3 for a specific car identification.
    Returns the image directly for display in browser or download.
    """
    return get_car_image_from_s3(str(identification_id), db)


@router.get("/nearby")
async def get_nearby_cars(
    request: Request,
    latitude: float = Query(..., description="Center latitude"),
    longitude: float = Query(..., description="Center longitude"),
    radius_km: float = Query(50, description="Search radius in kilometers"),
    db: Session = Depends(get_db)
):
    """Get car identifications within a given radius of a location."""
    
    # Approximate bounding box filter (1 degree lat ≈ 111 km)
    import math
    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * max(abs(math.cos(math.radians(latitude))), 0.01))
    
    results = db.query(CarIdentification).filter(
        and_(
            CarIdentification.is_car == True,
            CarIdentification.latitude.isnot(None),
            CarIdentification.longitude.isnot(None),
            CarIdentification.latitude.between(latitude - lat_delta, latitude + lat_delta),
            CarIdentification.longitude.between(longitude - lng_delta, longitude + lng_delta),
        )
    ).order_by(CarIdentification.created_at.desc()).limit(200).all()
    
    storage_service = CarStorageService(
        db_session=db,
        s3_bucket=aws_bucket_name or "carid-images"
    )
    
    cars = []
    for record in results:
        try:
            image_url = storage_service.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': storage_service.bucket, 'Key': record.s3_image_key},
                ExpiresIn=3600
            )
        except Exception:
            base_url = str(request.base_url).rstrip('/')
            image_url = f"{base_url}/api/v1/cars/identifications/{record.id}/image"
        
        cars.append({
            'id': record.id,
            'latitude': record.latitude,
            'longitude': record.longitude,
            'make': record.make,
            'model': record.model,
            'car_type': record.car_type,
            'year_estimate': record.year_estimate,
            'confidence': record.confidence,
            'image_url': image_url,
            'identification_data': record.identification_data,
            'created_at': record.created_at.isoformat() if record.created_at else None,
        })
    
    return {
        "results": cars,
        "count": len(cars),
        "center": {"latitude": latitude, "longitude": longitude},
        "radius_km": radius_km
    }