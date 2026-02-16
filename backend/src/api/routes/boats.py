from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
import json
import os
import boto3
import io
from botocore.exceptions import ClientError, NoCredentialsError
from models.boat import BoatIdentification
from models.user import User
from services.boat_identification import BoatIdentificationService
from utils.database import get_db
from api.routes.users import get_current_user
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

router = APIRouter()
security = HTTPBearer()

# Initialize S3 client
s3_client = boto3.client('s3')
aws_bucket_name = os.getenv("AWS_BUCKET_NAME")

boat_service = BoatIdentificationService()

def get_boat_image_from_s3(boat_id: str, db: Session) -> StreamingResponse:
    """
    Retrieve and stream boat image from S3 based on boat_id.
    Returns the actual image file.
    """
    try:
        # Get boat information from database
        boat = db.query(BoatIdentification).filter(
            BoatIdentification.id == boat_id
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

@router.post("/identify", summary="Identify boat from image")
async def identify_boat(
    image: UploadFile = File(...),
    user_id: str = Form(...),
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Upload an image and get boat identification results.
    """
    try:
        # Validate file type
        if not image.content_type.startswith('image/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be an image"
            )
        
        # Process the image
        result = await boat_service.identify_boat(image, user_id)
        
        # Save to database
        boat_identification = BoatIdentification(
            user_id=user_id,
            image_url=result.get("image_url"),
            image_s3_key=result.get("s3_key"),
            make=result.get("make"),
            model=result.get("model"),
            boat_type=result.get("boat_type"),
            dimensions=result.get("dimensions"),
            description=result.get("description"),
            confidence_score=result.get("confidence_score"),
            openai_response=result.get("openai_response")
        )
        
        db.add(boat_identification)
        db.commit()
        db.refresh(boat_identification)
        
        return {
            "id": str(boat_identification.id),
            "make": boat_identification.make,
            "model": boat_identification.model,
            "boat_type": boat_identification.boat_type,
            "dimensions": boat_identification.dimensions,
            "description": boat_identification.description,
            "confidence_score": float(boat_identification.confidence_score),
            "image_url": boat_identification.image_url
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error identifying boat: {str(e)}"
        )

@router.get("/history/{user_id}", summary="Get user's boat identification history")
async def get_boat_history(
    user_id: str,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    limit: int = 10,
    offset: int = 0
):
    """
    Get a user's boat identification history.
    """
    try:
        boats = db.query(BoatIdentification).filter(
            BoatIdentification.user_id == user_id
        ).offset(offset).limit(limit).all()
        
        return [
            {
                "id": str(boat.id),
                "make": boat.make,
                "model": boat.model,
                "boat_type": boat.boat_type,
                "dimensions": boat.dimensions,
                "description": boat.description,
                "confidence_score": float(boat.confidence_score) if boat.confidence_score else None,
                "image_url": boat.image_url,
                "created_at": boat.created_at.isoformat()
            }
            for boat in boats
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving boat history: {str(e)}"
        )

@router.get("/{boat_id}", summary="Get specific boat identification")
async def get_boat_identification(
    boat_id: str,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Get details of a specific boat identification.
    """
    try:
        boat = db.query(BoatIdentification).filter(
            BoatIdentification.id == boat_id
        ).first()
        
        if not boat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Boat identification not found"
            )
        
        return {
            "id": str(boat.id),
            "user_id": boat.user_id,
            "make": boat.make,
            "model": boat.model,
            "boat_type": boat.boat_type,
            "dimensions": boat.dimensions,
            "description": boat.description,
            "confidence_score": float(boat.confidence_score) if boat.confidence_score else None,
            "image_url": boat.image_url,
            "openai_response": boat.openai_response,
            "created_at": boat.created_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving boat identification: {str(e)}"
        )

@router.get("/", summary="Get all boat identifications (admin only)")
async def get_all_boats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """
    Get list of all boat identifications (admin functionality).
    """
    try:
        boats = db.query(BoatIdentification).offset(offset).limit(limit).all()
        
        return [
            {
                "id": str(boat.id),
                "user_id": boat.user_id,
                "make": boat.make,
                "model": boat.model,
                "boat_type": boat.boat_type,
                "dimensions": boat.dimensions,
                "description": boat.description,
                "confidence_score": float(boat.confidence_score) if boat.confidence_score else None,
                "image_url": boat.image_url,
                "created_at": boat.created_at.isoformat()
            }
            for boat in boats
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving boat identifications: {str(e)}"
        )

@router.get("/{boat_id}/image", summary="Get boat image from S3", response_class=StreamingResponse)
async def get_boat_image(
    boat_id: str,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Get the actual boat image file from S3 for a specific boat.
    Returns the image directly for display in browser or download.
    """
    return get_boat_image_from_s3(boat_id, db)