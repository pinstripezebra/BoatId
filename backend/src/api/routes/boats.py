from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
import json
from models.boat import BoatIdentification
from models.user import User
from services.boat_identification import BoatIdentificationService
from utils.database import get_db
from api.routes.users import get_current_user

router = APIRouter()
security = HTTPBearer()

boat_service = BoatIdentificationService()

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