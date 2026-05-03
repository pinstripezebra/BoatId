import io
import logging
import os

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from services.license_plate_service import LicensePlateBlurService
from utils.rate_limit import limiter

logger = logging.getLogger("carid.images")

router = APIRouter()

_ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png"}
_MAX_SIZE = 10 * 1024 * 1024  # 10 MB


def _get_blur_service() -> LicensePlateBlurService:
    return LicensePlateBlurService(aws_region=os.getenv("AWS_REGION", "us-west-2"))


@router.post(
    "/blur",
    summary="Blur license plates in an image",
    description=(
        "Upload an image and receive a copy with all detected license plates blurred. "
        "Response headers expose full Rekognition diagnostics for troubleshooting: "
        "`X-Plates-Detected`, `X-Detection-Method`, `X-All-Labels`, "
        "`X-Text-Lines-Found`, `X-Blur-Error`."
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
    blur_result = await blur_service.blur_license_plates(image_data, image.content_type)

    logger.info(
        "Blur endpoint: method=%s plates=%d labels=%s text_lines=%s error=%s",
        blur_result.detection_method,
        blur_result.plates_detected,
        blur_result.all_labels,
        blur_result.text_lines_found,
        blur_result.error,
    )

    return StreamingResponse(
        io.BytesIO(blur_result.image_data),
        media_type=image.content_type,
        headers={
            "Content-Disposition": f'inline; filename="blurred_{image.filename}"',
            "X-Plates-Detected": str(blur_result.plates_detected),
            "X-Detection-Method": blur_result.detection_method,
            # Comma-separated "Label:Confidence" from detect_labels
            "X-All-Labels": ", ".join(blur_result.all_labels) or "none",
            # LINE texts seen by detect_text fallback (empty if not triggered)
            "X-Text-Lines-Found": ", ".join(blur_result.text_lines_found) or "n/a",
            "X-Blur-Error": blur_result.error or "none",
        },
    )
