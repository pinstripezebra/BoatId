import boto3
from botocore.exceptions import ClientError
import uuid
import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class S3Service:
    def __init__(self):
        self.s3_client = boto3.client('s3')
        self.bucket_name = os.getenv('S3_BUCKET_NAME')
        
        if not self.bucket_name:
            raise ValueError("S3_BUCKET_NAME environment variable is required")
    
    async def upload_image(self, image_data: bytes, content_type: str) -> Optional[str]:
        try:
            # Generate unique filename
            file_extension = content_type.split('/')[-1]
            filename = f"boat-images/{uuid.uuid4()}.{file_extension}"
            
            # Upload to S3
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=filename,
                Body=image_data,
                ContentType=content_type,
                ACL='private'
            )
            
            # Return S3 URL
            return f"https://{self.bucket_name}.s3.amazonaws.com/{filename}"
            
        except ClientError as e:
            print(f"Error uploading to S3: {e}")
            return None