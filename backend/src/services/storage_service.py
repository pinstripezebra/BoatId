import boto3
import json
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from models.car import CarIdentification
from image_identification import CarIdentificationResult
from typing import List, Optional, Dict
import os
from uuid import UUID

class CarStorageService:
    def __init__(self, db_session: Session, s3_bucket: str, aws_region: str = None):
        self.db = db_session
        
        # Use provided region, env var, or default to us-west-2
        region = aws_region or os.getenv('AWS_REGION', os.getenv('AWS_DEFAULT_REGION', 'us-west-2'))
        
        # Initialize S3 client with better error handling
        try:
            self.s3_client = boto3.client('s3', region_name=region)
            self.bucket = s3_bucket
            
            # Test S3 connection by checking if bucket exists
            self.s3_client.head_bucket(Bucket=s3_bucket)
        except Exception as e:
            print(f"Warning: S3 configuration issue: {e}")
            # Still create client for graceful degradation
            self.s3_client = boto3.client('s3', region_name=region)
            self.bucket = s3_bucket
    
    async def store_identification_result(
        self, 
        image_filename: str,
        image_data: bytes,
        result: CarIdentificationResult,
        user_id: Optional[UUID] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None
    ) -> int:
        """Store image in S3 and identification data in RDS"""
        
        # Generate unique S3 key
        timestamp = datetime.utcnow().strftime("%Y/%m/%d")
        unique_id = str(uuid.uuid4())
        file_extension = image_filename.split('.')[-1].lower()
        s3_key = f"car-images/{timestamp}/{unique_id}.{file_extension}"
        
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
                    'is_car': str(result.is_car),
                    'confidence': result.confidence or 'unknown'
                }
            )
            
            # Prepare JSON data
            identification_json = {
                'is_car': result.is_car,
                'make': result.make,
                'model': result.model,
                'description': result.description,
                'year': result.year,
                'length': result.length,
                'car_type': result.car_type,
                'confidence': result.confidence,
                'body_type': result.body_type,
                'features': result.features or []
            }
            
            # Store in database
            db_record = CarIdentification(
                user_id=user_id,
                image_filename=image_filename,
                s3_image_key=s3_key,
                is_car=result.is_car,
                confidence=result.confidence,
                identification_data=identification_json,
                make=result.make,
                model=result.model,
                car_type=result.car_type,
                year_estimate=result.year,
                latitude=latitude,
                longitude=longitude
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
        is_car: Optional[bool] = None,
        make: Optional[str] = None,
        car_type: Optional[str] = None,
        confidence: Optional[str] = None,
        user_id: Optional[UUID] = None
    ) -> Dict:
        """Get identification results with pagination and filtering"""
        
        query = self.db.query(CarIdentification)
        
        # Filter by user
        if user_id is not None:
            query = query.filter(CarIdentification.user_id == user_id)
        
        # Apply filters
        if is_car is not None:
            query = query.filter(CarIdentification.is_car == is_car)
        if make:
            query = query.filter(CarIdentification.make.ilike(f"%{make}%"))
        if car_type:
            query = query.filter(CarIdentification.car_type.ilike(f"%{car_type}%"))
        if confidence:
            query = query.filter(CarIdentification.confidence == confidence)
        
        # Get total count
        total_count = query.count()
        
        # Apply pagination and ordering
        results = query.order_by(CarIdentification.created_at.desc())\
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
                image_url = f"/api/cars/identifications/{record.id}/image"  # Fallback to API endpoint
            
            formatted_results.append({
                'id': record.id,
                'image_url': image_url,
                'filename': record.image_filename,
                'created_at': record.created_at.isoformat(),
                'identification_data': record.identification_data,
                'is_car': record.is_car
            })
        
        return {
            'results': formatted_results,
            'total_count': total_count,
            'page_size': limit,
            'offset': offset
        }
    
    def get_identification_by_id(self, identification_id: int) -> Optional[Dict]:
        """Get specific identification result by ID"""
        
        record = self.db.query(CarIdentification)\
                       .filter(CarIdentification.id == identification_id)\
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
            image_url = f"/api/cars/identifications/{record.id}/image"
        
        return {
            'id': record.id,
            'image_url': image_url,
            'filename': record.image_filename,
            'created_at': record.created_at.isoformat(),
            'identification_data': record.identification_data,
            'is_car': record.is_car
        }
    
    def search_cars(self, search_term: str, limit: int = 50, offset: int = 0) -> Dict:
        """Search cars using PostgreSQL full-text search, sorted by popularity."""
        from sqlalchemy import func, text
        from models.car_popularity import CarPopularity

        # Build tsquery from search term — split words and join with &
        words = search_term.strip().split()
        if not words:
            return {'results': [], 'total_count': 0}

        # Use plainto_tsquery for safe parsing of user input
        ts_query = func.plainto_tsquery('english', search_term.strip())

        # Base query: match against search_vector, join with popularity
        base_query = (
            self.db.query(
                CarIdentification,
                func.coalesce(CarPopularity.likes, 0).label('likes'),
                func.ts_rank(CarIdentification.search_vector, ts_query).label('rank'),
            )
            .outerjoin(CarPopularity, CarPopularity.id == CarIdentification.id)
            .filter(CarIdentification.is_car == True)
            .filter(CarIdentification.search_vector.op('@@')(ts_query))
        )

        total_count = base_query.count()

        rows = (
            base_query
            .order_by(text('likes DESC'), text('rank DESC'))
            .offset(offset)
            .limit(limit)
            .all()
        )

        results = []
        for record, likes, rank in rows:
            try:
                image_url = self.s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': self.bucket, 'Key': record.s3_image_key},
                    ExpiresIn=3600
                )
            except Exception as e:
                print(f"Warning: Could not generate presigned URL: {e}")
                image_url = f"/api/cars/identifications/{record.id}/image"

            results.append({
                'id': record.id,
                'image_url': image_url,
                'make': record.make,
                'model': record.model,
                'car_type': record.car_type,
                'year_estimate': record.year_estimate,
                'confidence': record.confidence,
                'identification_data': record.identification_data,
                'likes': likes,
                'relevance_score': float(rank) if rank else 0.0,
            })

        return {'results': results, 'total_count': total_count}

    def update_identification(
        self,
        identification_id: int,
        user_id: UUID,
        updates: Dict
    ) -> Optional[Dict]:
        """Update an identification record with user-edited data."""
        record = self.db.query(CarIdentification)\
                       .filter(CarIdentification.id == identification_id)\
                       .first()

        if not record:
            return None

        if record.user_id != user_id:
            raise PermissionError("Not authorized to edit this identification")

        # Editable top-level columns
        column_map = {
            'make': 'make',
            'model': 'model',
            'car_type': 'car_type',
            'year': 'year_estimate',
        }
        for field, column in column_map.items():
            if field in updates:
                setattr(record, column, updates[field])

        # Update the identification_data JSON blob
        id_data = dict(record.identification_data) if record.identification_data else {}
        json_fields = ['make', 'model', 'description', 'car_type', 'year', 'body_type', 'features']
        for field in json_fields:
            if field in updates:
                id_data[field] = updates[field]
        record.identification_data = id_data

        record.user_modified = True

        try:
            self.db.commit()
            self.db.refresh(record)
            return {
                'id': record.id,
                'identification_data': record.identification_data,
                'user_modified': record.user_modified,
            }
        except Exception as e:
            self.db.rollback()
            raise RuntimeError(f"Failed to update identification: {str(e)}")
