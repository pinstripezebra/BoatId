import io
import logging
import os
from typing import Optional

import boto3
from botocore.exceptions import ClientError
from PIL import Image, ImageFilter

logger = logging.getLogger(__name__)

_DEFAULT_BLUR_RADIUS = 20


class LicensePlateBlurService:
    def __init__(self, aws_region: str):
        self._rekognition = boto3.client("rekognition", region_name=aws_region)
        self._blur_radius = int(os.getenv("BLUR_RADIUS", _DEFAULT_BLUR_RADIUS))

    async def blur_license_plates(
        self, image_data: bytes, content_type: str = "image/jpeg"
    ) -> bytes:
        """
        Detect license plates in the image using AWS Rekognition and blur them.
        Returns blurred image bytes. Falls back to original bytes on any error.
        """
        try:
            response = self._rekognition.detect_labels(
                Image={"Bytes": image_data},
                MinConfidence=70,
                Settings={
                    "GeneralLabels": {
                        "LabelInclusionFilters": ["License Plate"]
                    }
                },
            )
        except ClientError as exc:
            logger.warning("Rekognition detect_labels failed, skipping blur: %s", exc)
            return image_data
        except Exception as exc:
            logger.warning("Unexpected error during Rekognition call, skipping blur: %s", exc)
            return image_data

        # Collect bounding boxes for all detected license plate instances
        bounding_boxes = []
        for label in response.get("Labels", []):
            if label.get("Name") == "License Plate":
                for instance in label.get("Instances", []):
                    box = instance.get("BoundingBox")
                    if box:
                        bounding_boxes.append(box)

        if not bounding_boxes:
            return image_data

        try:
            img = Image.open(io.BytesIO(image_data)).convert("RGBA")
            width, height = img.size

            for box in bounding_boxes:
                left = int(box["Left"] * width)
                top = int(box["Top"] * height)
                right = int((box["Left"] + box["Width"]) * width)
                bottom = int((box["Top"] + box["Height"]) * height)

                # Clamp to image bounds
                left = max(0, left)
                top = max(0, top)
                right = min(width, right)
                bottom = min(height, bottom)

                region = img.crop((left, top, right, bottom))
                blurred_region = region.filter(ImageFilter.GaussianBlur(radius=self._blur_radius))
                img.paste(blurred_region, (left, top, right, bottom))

            # Serialise back to the original format
            output_format = "JPEG" if content_type in ("image/jpeg", "image/jpg") else "PNG"
            output_mode = "RGB" if output_format == "JPEG" else "RGBA"
            img = img.convert(output_mode)

            buf = io.BytesIO()
            img.save(buf, format=output_format)
            return buf.getvalue()

        except Exception as exc:
            logger.warning("Failed to apply blur, returning original image: %s", exc)
            return image_data
