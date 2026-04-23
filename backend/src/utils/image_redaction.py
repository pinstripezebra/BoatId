import boto3
from PIL import Image, ImageFilter
import io
import os
import numpy as np
from typing import Tuple

def get_rekognition_client():
    return boto3.client('rekognition', region_name=os.getenv('AWS_REGION', 'us-west-2'))

def blur_license_plates(image_bytes: bytes) -> bytes:
    """
    Detect license plates using AWS Rekognition DetectText and blur them in the image.
    Returns the (possibly) redacted image as bytes.
    """
    client = get_rekognition_client()
    image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    width, height = image.size

    # Call Rekognition DetectText
    response = client.detect_text(Image={'Bytes': image_bytes})
    blurred = False
    for detection in response.get('TextDetections', []):
        # Only consider detected words (not lines)
        if detection['Type'] != 'WORD':
            continue
        text = detection['DetectedText']
        # Heuristic: license plates are usually 5-8 alphanumeric chars, no spaces
        if 5 <= len(text) <= 8 and text.replace(' ', '').isalnum():
            box = detection['Geometry']['BoundingBox']
            # Convert relative box to pixel coordinates
            left = int(box['Left'] * width)
            top = int(box['Top'] * height)
            w = int(box['Width'] * width)
            h = int(box['Height'] * height)
            # Crop, blur, and paste back
            region = image.crop((left, top, left + w, top + h))
            region = region.filter(ImageFilter.GaussianBlur(radius=12))
            image.paste(region, (left, top))
            blurred = True
    # Return the redacted image as bytes
    out = io.BytesIO()
    image.save(out, format='JPEG', quality=90)
    return out.getvalue()
