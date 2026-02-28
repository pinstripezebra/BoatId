from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
import json
import os
import boto3
import io
from botocore.exceptions import ClientError, NoCredentialsError
from models.boat import BoatIdentification
from models.user import User
from services.storage_service import BoatStorageService
from utils.database import get_db
from api.routes.users import get_current_user
from dotenv import load_dotenv
from image_identification import AnthropicBoatIdentifier, BoatIdentificationResult


# Load environment variables
load_dotenv()

router = APIRouter()
security = HTTPBearer()

# Initialize S3 client
s3_client = boto3.client('s3')
aws_bucket_name = os.getenv("AWS_BUCKET_NAME")
anthropic_key = os.getenv("ANTHROPIC_API_KEY")

# Dependency to get boat identifier
def get_boat_identifier():
    if not anthropic_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")
    return AnthropicBoatIdentifier(api_key=anthropic_key)

@router.post("/identify")
async def identify_boat_from_image(
    image: UploadFile = File(..., description="Image file to analyze"),
    requested_fields: Optional[str] = Form(None, description="Comma-separated list of fields to return"),
    store_results: bool = Form(True, description="Whether to store results in database"),
    identifier: AnthropicBoatIdentifier = Depends(get_boat_identifier),
    db: Session = Depends(get_db)
):
    """
    Identify boat details from an uploaded image using Anthropic's Claude Vision model.
    
    Returns structured information about the boat including make, model, type, and other details.
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
        
        # Identify boat using Anthropic
        result = await identifier.identify_boat(image_data, fields)
        
        # Store results if requested
        identification_id = None
        if store_results:
            storage_service = BoatStorageService(
                db_session=db,
                s3_bucket=aws_bucket_name or "boatid-images"
            )
            identification_id = await storage_service.store_identification_result(
                image_filename=image.filename or "boat_image.jpg",
                image_data=image_data,
                result=result
            )
        
        # Build response
        response_data = {
            "success": True,
            "identification_id": identification_id,
            "filename": image.filename,
            "is_boat": result.is_boat
        }
        
        if result.is_boat:
            # Add boat details to response
            boat_data = {}
            
            # Include all non-None fields
            for field_name in ['make', 'model', 'description', 'year', 'length', 
                             'boat_type', 'hull_material', 'features']:
                value = getattr(result, field_name)
                if value is not None:
                    # Only include if no specific fields requested or field was requested
                    if not fields or field_name in fields:
                        boat_data[field_name] = value
            
            response_data.update({
                "boat_details": boat_data,
                "confidence": result.confidence
            })
                
        else:
            response_data.update({
                "message": "No boat detected in the image",
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
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


# for uploading files to s3 bucket
@router.post("/upload", summary="Upload file to S3")
async def upload_file_to_s3(file: UploadFile | None = None):
    if file is None:
        return {"error": "No file provided"}
    try:
        s3_client.upload_fileobj(file.file, aws_bucket_name, file.filename)
        return {"message": "File uploaded successfully"}
    except Exception as e:
        return {"error": str(e)}


def get_boat_image_from_s3(boat_id: str, db: Session) -> StreamingResponse:
    """
    Retrieve and stream boat image from S3 based on boat_id.
    Returns the actual image file.
    """
    try:
        # Get boat information from database
        boat = db.query(BoatIdentification).filter(
            BoatIdentification.id == int(boat_id)
        ).first()
        
        if not boat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Boat not found"
            )
        
        if not boat.image_s3_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No image associated with this boat"
            )
        
        if not aws_bucket_name:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="S3 configuration not found"
            )
        
        # Get image object from S3
        try:
            response = s3_client.get_object(Bucket=aws_bucket_name, Key=boat.image_s3_key)
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
                detail=f"Error accessing S3: {str(e)}"
            )
        
        # Return image as streaming response
        return StreamingResponse(
            io.BytesIO(image_content),
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename=\"{boat.make}_{boat.model}_image.png\""
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
            detail=f"Error retrieving boat image: {str(e)}"
        )

@router.get("/identifications")
async def get_boat_identifications(
    page: int = 1,
    per_page: int = 50,
    is_boat: Optional[bool] = None,
    make: Optional[str] = None,
    boat_type: Optional[str] = None,
    confidence: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get paginated list of boat identifications with filtering"""
    
    storage_service = BoatStorageService(
        db_session=db,
        s3_bucket=aws_bucket_name or "boatid-images"
    )
    
    offset = (page - 1) * per_page
    
    results = storage_service.get_identification_results(
        limit=per_page,
        offset=offset,
        is_boat=is_boat,
        make=make,
        boat_type=boat_type,
        confidence=confidence
    )
    
    return {
        **results,
        "page": page,
        "per_page": per_page,
        "total_pages": (results['total_count'] + per_page - 1) // per_page
    }

@router.get("/identifications/{identification_id}")
async def get_boat_identification(
    identification_id: int,
    db: Session = Depends(get_db)
):
    """Get specific boat identification by ID"""
    
    storage_service = BoatStorageService(
        db_session=db,
        s3_bucket=aws_bucket_name or "boatid-images"
    )
    
    result = storage_service.get_identification_by_id(identification_id)
    
    if not result:
        raise HTTPException(status_code=404, detail="Identification not found")
    
    return result

@router.get("/search")
async def search_boats(
    q: str,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Search boat identifications"""
    
    storage_service = BoatStorageService(
        db_session=db,
        s3_bucket=aws_bucket_name or "boatid-images"
    )
    
    results = storage_service.search_boats(q, limit)
    
    return {
        "query": q,
        "results": results,
        "count": len(results)
    }

@router.get("/identification-fields")
async def get_available_identification_fields():
    """
    Get the list of available fields that can be requested for boat identification.
    """
    return {
        "available_fields": [
            {
                "field": "make",
                "description": "Manufacturer or brand name",
                "example": "Sea Ray, Boston Whaler, Beneteau"
            },
            {
                "field": "model", 
                "description": "Specific model name",
                "example": "Sundancer 350, Outrage 370"
            },
            {
                "field": "description",
                "description": "Detailed physical description of the boat",
                "example": "White fiberglass cabin cruiser with blue stripe"
            },
            {
                "field": "year",
                "description": "Estimated year or year range",
                "example": "2015, 2010-2015, unknown"
            },
            {
                "field": "length",
                "description": "Estimated length in feet", 
                "example": "25, 30-35, unknown"
            },
            {
                "field": "boat_type",
                "description": "Type or category of boat",
                "example": "sailboat, motorboat, yacht, fishing boat"
            },
            {
                "field": "hull_material",
                "description": "Material used for the hull",
                "example": "fiberglass, wood, aluminum"
            },
            {
                "field": "features",
                "description": "Notable features and equipment (array)",
                "example": ["hardtop", "fishing towers", "bow thruster"]
            }
        ]
    }

@router.get("/identifications/{identification_id}/image", response_class=StreamingResponse)
async def get_boat_image(
    identification_id: int,
    db: Session = Depends(get_db)
):
    """
    Get the actual boat image file from S3 for a specific boat identification.
    Returns the image directly for display in browser or download.
    """
    return get_boat_image_from_s3(str(identification_id), db)