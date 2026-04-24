import io
import os

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from services.license_plate_service import LicensePlateBlurService
from utils.rate_limit import limiter

router = APIRouter()

_ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png"}
_MAX_SIZE = 10 * 1024 * 1024  # 10 MB


def _get_blur_service() -> LicensePlateBlurService:
    return LicensePlateBlurService(aws_region=os.getenv("AWS_REGION", "us-west-2"))


@router.post(
    "/blur",
    summary="Blur license plates in an image",
    description=(
        "Upload an image and receive a copy with all detected license plates "
        "blurred. Useful for testing the license plate redaction pipeline."
    ),
    response_class=StreamingResponse,
)
@limiter.limit("10/minute")
async def blur_license_plates(
    request: Request,
    image: UploadFile = File(..., description="JPEG or PNG image to redact"),
) -> StreamingResponse:
    if image.content_type not in _ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Supported types: {', '.join(sorted(_ALLOWED_TYPES))}",
        )

    if image.size and image.size > _MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10 MB.")

    image_data = await image.read()

    blur_service = _get_blur_service()
    blurred_data = await blur_service.blur_license_plates(image_data, image.content_type)

    return StreamingResponse(
        io.BytesIO(blurred_data),
        media_type=image.content_type,
        headers={"Content-Disposition": f'inline; filename="blurred_{image.filename}"'},
    )
