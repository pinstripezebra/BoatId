import boto3
import json
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from models.boat import BoatIdentification
from image_identification import BoatIdentificationResult
from typing import List, Optional, Dict
import os

class BoatStorageService:
    def __init__(self, db_session: Session, s3_bucket: str, aws_region: str = "us-east-1"):
        self.db = db_session
        
        # Initialize S3 client with better error handling
        try:
            self.s3_client = boto3.client('s3', region_name=aws_region)
            self.bucket = s3_bucket
            
            # Test S3 connection by checking if bucket exists
            self.s3_client.head_bucket(Bucket=s3_bucket)
        except Exception as e:
            print(f"Warning: S3 configuration issue: {e}")
            # Still create client for graceful degradation
            self.s3_client = boto3.client('s3', region_name=aws_region)
            self.bucket = s3_bucket
    
    async def store_identification_result(
        self, 
        image_filename: str,
        image_data: bytes,
        result: BoatIdentificationResult
    ) -> int:
        """Store image in S3 and identification data in RDS"""
        
        # Generate unique S3 key
        timestamp = datetime.utcnow().strftime("%Y/%m/%d")
        unique_id = str(uuid.uuid4())
        file_extension = image_filename.split('.')[-1].lower()
        s3_key = f"boat-images/{timestamp}/{unique_id}.{file_extension}"
        
        try:
            # Upload image to S3 with better error handling
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=s3_key,
                Body=image_data,
                ContentType=f"image/{file_extension}",
                Metadata={
                    'original_filename': image_filename,
                    'upload_timestamp': datetime.utcnow().isoformat(),
                    'is_boat': str(result.is_boat),
                    'confidence': result.confidence or 'unknown'
                }
            )
            
            # Prepare JSON data
            identification_json = {
                'is_boat': result.is_boat,
                'make': result.make,
                'model': result.model,
                'description': result.description,
                'year': result.year,
                'length': result.length,
                'boat_type': result.boat_type,
                'confidence': result.confidence,
                'hull_material': result.hull_material,
                'features': result.features or []
            }
            
            # Store in database
            db_record = BoatIdentification(
                image_filename=image_filename,
                s3_image_key=s3_key,
                is_boat=result.is_boat,
                confidence=result.confidence,
                identification_data=identification_json,
                make=result.make,
                model=result.model,
                boat_type=result.boat_type,
                year_estimate=result.year
            )
            
            self.db.add(db_record)
            self.db.commit()
            
            return db_record.id
            
        except Exception as e:
            self.db.rollback()
            # More specific error handling
            if "NoCredentialsError" in str(type(e)):
                raise RuntimeError("AWS credentials not configured properly")
            elif "NoSuchBucket" in str(e):
                raise RuntimeError(f"S3 bucket '{self.bucket}' does not exist")
            elif "AccessDenied" in str(e):
                raise RuntimeError("Access denied to S3 bucket - check AWS permissions")
            else:
                raise RuntimeError(f"Failed to store identification result: {str(e)}")
    
    def get_identification_results(
        self, 
        limit: int = 50,
        offset: int = 0,
        is_boat: Optional[bool] = None,
        make: Optional[str] = None,
        boat_type: Optional[str] = None,
        confidence: Optional[str] = None
    ) -> Dict:
        """Get identification results with pagination and filtering"""
        
        query = self.db.query(BoatIdentification)
        
        # Apply filters
        if is_boat is not None:
            query = query.filter(BoatIdentification.is_boat == is_boat)
        if make:
            query = query.filter(BoatIdentification.make.ilike(f"%{make}%"))
        if boat_type:
            query = query.filter(BoatIdentification.boat_type.ilike(f"%{boat_type}%"))
        if confidence:
            query = query.filter(BoatIdentification.confidence == confidence)
        
        # Get total count
        total_count = query.count()
        
        # Apply pagination and ordering
        results = query.order_by(BoatIdentification.created_at.desc())\
                      .offset(offset)\
                      .limit(limit)\
                      .all()
        
        # Format results for frontend
        formatted_results = []
        for record in results:
            try:
                # Generate presigned URL for image
                image_url = self.s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': self.bucket, 'Key': record.s3_image_key},
                    ExpiresIn=3600  # 1 hour
                )
            except Exception as e:
                # Graceful fallback if S3 URL generation fails
                print(f"Warning: Could not generate presigned URL for {record.s3_image_key}: {e}")
                image_url = f"/api/boats/identifications/{record.id}/image"  # Fallback to API endpoint
            
            formatted_results.append({
                'id': record.id,
                'image_url': image_url,
                'filename': record.image_filename,
                'created_at': record.created_at.isoformat(),
                'identification_data': record.identification_data,
                'is_boat': record.is_boat
            })
        
        return {
            'results': formatted_results,
            'total_count': total_count,
            'page_size': limit,
            'offset': offset
        }
    
    def get_identification_by_id(self, identification_id: int) -> Optional[Dict]:
        """Get specific identification result by ID"""
        
        record = self.db.query(BoatIdentification)\
                       .filter(BoatIdentification.id == identification_id)\
                       .first()
        
        if not record:
            return None
        
        # Generate presigned URL with error handling
        try:
            image_url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': record.s3_image_key},
                ExpiresIn=3600
            )
        except Exception as e:
            print(f"Warning: Could not generate presigned URL: {e}")
            image_url = f"/api/boats/identifications/{record.id}/image"
        
        return {
            'id': record.id,
            'image_url': image_url,
            'filename': record.image_filename,
            'created_at': record.created_at.isoformat(),
            'identification_data': record.identification_data,
            'is_boat': record.is_boat
        }
    
    def search_boats(self, search_term: str, limit: int = 50) -> List[Dict]:
        """Search boats by make, model, or description"""
        
        # Use PostgreSQL's JSON operators for flexible search
        query = self.db.query(BoatIdentification)\
                      .filter(BoatIdentification.is_boat == True)\
                      .filter(
                          BoatIdentification.make.ilike(f"%{search_term}%") |
                          BoatIdentification.model.ilike(f"%{search_term}%") |
                          BoatIdentification.identification_data['description'].astext.ilike(f"%{search_term}%")
                      )\
                      .order_by(BoatIdentification.created_at.desc())\
                      .limit(limit)
        
        results = []
        for record in query.all():
            try:
                image_url = self.s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': self.bucket, 'Key': record.s3_image_key},
                    ExpiresIn=3600
                )
            except Exception as e:
                print(f"Warning: Could not generate presigned URL: {e}")
                image_url = f"/api/boats/identifications/{record.id}/image"
            
            results.append({
                'id': record.id,
                'image_url': image_url,
                'identification_data': record.identification_data,
                'relevance_score': 1.0  # You could implement proper scoring
            })
        
        return results
