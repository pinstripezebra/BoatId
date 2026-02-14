from typing import Dict, Any, Optional
from fastapi import UploadFile
import boto3
from botocore.exceptions import ClientError
import openai
import os
import json
from PIL import Image
import io
import uuid
from datetime import datetime

class BoatIdentificationService:
    def __init__(self):
        self.s3_client = boto3.client('s3')
        self.bucket_name = os.getenv('S3_BUCKET_NAME', 'boat-images-bucket')
        openai.api_key = os.getenv('OPENAI_API_KEY')
    
    async def identify_boat(self, image_file: UploadFile, user_id: str) -> Dict[str, Any]:
        """
        Main method to identify a boat from an uploaded image.
        
        Args:
            image_file: The uploaded image file
            user_id: ID of the user uploading the image
            
        Returns:
            Dictionary containing boat identification results
        """
        try:
            # Generate unique filename
            file_extension = image_file.filename.split('.')[-1]
            s3_key = f"boat-images/{user_id}/{uuid.uuid4()}.{file_extension}"
            
            # Upload image to S3
            image_url = await self._upload_to_s3(image_file, s3_key)
            
            # Process image with OpenAI Vision API
            openai_response = await self._analyze_with_openai(image_file)
            
            # Extract structured data from OpenAI response
            boat_data = self._parse_openai_response(openai_response)
            
            return {
                "image_url": image_url,
                "s3_key": s3_key,
                "make": boat_data.get("make"),
                "model": boat_data.get("model"),
                "boat_type": boat_data.get("boat_type"),
                "dimensions": boat_data.get("dimensions"),
                "description": boat_data.get("description"),
                "confidence_score": boat_data.get("confidence_score", 0.0),
                "openai_response": openai_response
            }
            
        except Exception as e:
            raise Exception(f"Error in boat identification: {str(e)}")
    
    async def _upload_to_s3(self, image_file: UploadFile, s3_key: str) -> str:
        """
        Upload image to S3 and return the public URL.
        """
        try:
            # Reset file pointer
            image_file.file.seek(0)
            
            # Upload to S3
            self.s3_client.upload_fileobj(
                image_file.file,
                self.bucket_name,
                s3_key,
                ExtraArgs={'ContentType': image_file.content_type}
            )
            
            # Return public URL
            return f"https://{self.bucket_name}.s3.amazonaws.com/{s3_key}"
            
        except ClientError as e:
            raise Exception(f"Failed to upload image to S3: {str(e)}")
    
    async def _analyze_with_openai(self, image_file: UploadFile) -> Dict[str, Any]:
        """
        Analyze the boat image using OpenAI Vision API.
        """
        try:
            # Reset file pointer
            image_file.file.seek(0)
            
            # Read image data
            image_data = await image_file.read()
            
            # Convert to base64 for OpenAI API
            import base64
            image_base64 = base64.b64encode(image_data).decode('utf-8')
            
            # Call OpenAI Vision API
            response = openai.ChatCompletion.create(
                model="gpt-4-vision-preview",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": """Analyze this boat image and provide the following information in JSON format:
                                {
                                    "make": "boat manufacturer",
                                    "model": "boat model name",
                                    "boat_type": "type of boat (e.g., sailboat, yacht, fishing boat, etc.)",
                                    "dimensions": {
                                        "length": "estimated length in feet",
                                        "beam": "estimated beam/width in feet",
                                        "draft": "estimated draft in feet"
                                    },
                                    "description": "detailed description of the boat",
                                    "confidence_score": "confidence level from 0.0 to 1.0"
                                }
                                
                                If you cannot identify certain details, use null for that field."""
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_base64}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=500
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            raise Exception(f"OpenAI analysis failed: {str(e)}")
    
    def _parse_openai_response(self, openai_response: str) -> Dict[str, Any]:
        """
        Parse the OpenAI response and extract structured boat data.
        """
        try:
            # Try to extract JSON from the response
            if isinstance(openai_response, str):
                # Look for JSON content in the response
                start_idx = openai_response.find('{')
                end_idx = openai_response.rfind('}') + 1
                
                if start_idx != -1 and end_idx != -1:
                    json_str = openai_response[start_idx:end_idx]
                    boat_data = json.loads(json_str)
                    return boat_data
            
            # If JSON parsing fails, return default structure
            return {
                "make": None,
                "model": None,
                "boat_type": None,
                "dimensions": None,
                "description": "Unable to parse boat details",
                "confidence_score": 0.0
            }
            
        except json.JSONDecodeError:
            return {
                "make": None,
                "model": None,
                "boat_type": None,
                "dimensions": None,
                "description": "Unable to parse boat details",
                "confidence_score": 0.0
            }
    
    def _validate_image(self, image_file: UploadFile) -> bool:
        """
        Validate that the uploaded file is a valid image.
        """
        try:
            # Check file extension
            valid_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp']
            file_extension = '.' + image_file.filename.split('.')[-1].lower()
            
            if file_extension not in valid_extensions:
                return False
            
            # Try to open with PIL to verify it's a valid image
            image_file.file.seek(0)
            image = Image.open(image_file.file)
            image.verify()
            
            return True
            
        except Exception:
            return False