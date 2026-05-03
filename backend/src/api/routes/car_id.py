from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
import asyncio
import io
import json
import logging
import os
import re as _re
import time
import boto3
from PIL import Image as _PIL_Image, ImageOps as _PIL_ImageOps
from datetime import datetime, timezone

logger = logging.getLogger("carid.car_id")

from models.badge import Badge
from models.car import CarIdentification
from models.user import User
from models.user_camera_stats import UserCameraStats
from services.storage_service import CarStorageService
from services.badge_service import check_and_award_badges
from services.license_plate_service import LicensePlateBlurService
from utils.database import get_db
from utils.rate_limit import limiter
from utils.image_redaction import blur_license_plates
from api.routes.users import get_current_user_optional
from dotenv import load_dotenv
from image_identification import AnthropicCarIdentifier, CarIdentificationResult

load_dotenv()

router = APIRouter()

# S3 / Anthropic config
s3_client = boto3.client('s3', region_name=os.getenv('AWS_REGION', 'us-west-2'))
aws_bucket_name = os.getenv("AWS_BUCKET_NAME")
_anthropic_key = os.getenv("ANTHROPIC_API_KEY")

_PLATE_KEYWORDS = ('license', 'licence', 'plate number', 'registration', 'number plate')
_PLATE_CANDIDATE_RE = _re.compile(r'[A-Z0-9]{2,6}(?:[\ \-][A-Z0-9]{1,6})+|[A-Z0-9]{4,10}', _re.IGNORECASE)


def _extract_plate_texts_from_features(features) -> list:
    """Return candidate license-plate strings found inside Claude feature entries."""
    texts = []
    for f in (features or []):
        if any(kw in f.lower() for kw in _PLATE_KEYWORDS):
            for m in _PLATE_CANDIDATE_RE.findall(f):
                normalized = _re.sub(r'[\s\-]', '', m.upper())
                if 4 <= len(normalized) <= 10:
                    texts.append(m.upper())
    return texts


def _normalize_exif(image_data: bytes) -> bytes:
    """Physically rotate image pixels to match EXIF orientation tag, then strip the tag.
    Returns original bytes unchanged on any error."""
    try:
        pil = _PIL_Image.open(io.BytesIO(image_data))
        orig_format = pil.format or 'JPEG'
        pil = _PIL_ImageOps.exif_transpose(pil)
        buf = io.BytesIO()
        pil.save(buf, format=orig_format)
        return buf.getvalue()
    except Exception:
        return image_data


def get_car_identifier() -> AnthropicCarIdentifier:
    """Dependency: returns a configured AnthropicCarIdentifier (Sonnet for identification)."""
    if not _anthropic_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")
    return AnthropicCarIdentifier(api_key=_anthropic_key)


@router.post("/identify")
@limiter.limit("20/minute")
async def identify_car_from_image(
    request: Request,
    image: UploadFile = File(..., description="Image file to analyze"),
    requested_fields: Optional[str] = Form(
        ['make', 'model', 'description', 'year', 'length', 'car_type', 'body_type', 'features'],
        description="Comma-separated list of fields to return",
    ),
    store_results: bool = Form(True, description="Whether to store results in database"),
    latitude: Optional[float] = Form(None, description="Latitude of where the photo was taken"),
    longitude: Optional[float] = Form(None, description="Longitude of where the photo was taken"),
    identifier: AnthropicCarIdentifier = Depends(get_car_identifier),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Three-stage car identification pipeline:
      1. find_make  — Haiku detects manufacturer from badge/logo (fast, cheap)
      2. identify_car — Sonnet identifies full details, constrained by make hint when confident
      3. blur_license_plates — runs in parallel with stage 2; only stored to S3 if is_car=true
    """

    # Authentication required for identification
    if current_user is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"X-Error-Code": "auth_required"},
        )

    # Enforce weekly usage limits
    stats = db.query(UserCameraStats).filter(UserCameraStats.user_id == current_user.id).first()
    if stats is None:
        stats = UserCameraStats(user_id=current_user.id, weekly_count=0, week_start=datetime.now(timezone.utc))
        db.add(stats)
        db.commit()
        db.refresh(stats)

    if current_user.user_type == 'basic' and stats.weekly_count >= 1:
        raise HTTPException(
            status_code=429,
            detail="Weekly identification limit reached",
            headers={"X-Error-Code": "limit_exceeded"},
        )

    # Validate file type
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png']
    if image.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Supported types: {', '.join(allowed_types)}",
        )

    # Validate file size (10 MB limit)
    max_size = 10 * 1024 * 1024
    if image.size and image.size > max_size:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    try:
        image_data = await image.read()

        # Normalize EXIF orientation once — all downstream code (blur, Claude, S3) sees upright pixels
        image_data = _normalize_exif(image_data)

        # Parse requested fields — accepts JSON array or comma-separated string
        fields: list[str] = []
        if requested_fields:
            try:
                parsed = json.loads(requested_fields)
                if isinstance(parsed, list):
                    fields = [str(f).strip() for f in parsed if str(f).strip()]
                else:
                    fields = [f.strip() for f in requested_fields.split(',') if f.strip()]
            except (json.JSONDecodeError, TypeError):
                fields = [f.strip() for f in requested_fields.split(',') if f.strip()]

        request_id = getattr(request.state, "request_id", None)
        user_id_str = str(current_user.id) if current_user else None

        # Stage 1: detect car make from badge / logo (Haiku)
        t0 = time.perf_counter()
        make_result = await identifier.find_make(image_data)
        make_hint = make_result.get("make")
        make_confidence = make_result.get("confidence")
        logger.info(
            "anthropic_find_make",
            extra={
                "request_id": request_id,
                "user_id": user_id_str,
                "make_hint": make_hint,
                "make_confidence": make_confidence,
                "duration_ms": round((time.perf_counter() - t0) * 1000, 1),
            },
        )

        # Stage 2 + 3 in parallel: identify car (Sonnet, with make hint) & blur license plates
        blur_service = LicensePlateBlurService(aws_region=os.getenv("AWS_REGION", "us-west-2"))
        t1 = time.perf_counter()
        result, blur_result = await asyncio.gather(
            identifier.identify_car(image_data, fields, make_hint, make_confidence),
            blur_service.blur_license_plates(image_data, image.content_type or "image/jpeg"),
        )
        logger.info(
            "anthropic_identify_car",
            extra={
                "request_id": request_id,
                "user_id": user_id_str,
                "is_car": result.is_car,
                "make": result.make,
                "model": result.model,
                "confidence": result.confidence,
                "plates_detected": blur_result.plates_detected,
                "duration_ms": round((time.perf_counter() - t1) * 1000, 1),
            },
        )

        # If Rekognition missed the plate but Claude found it in features, do a targeted re-blur
        final_image_data = blur_result.image_data
        if result.is_car and blur_result.plates_detected == 0:
            plate_texts = _extract_plate_texts_from_features(getattr(result, 'features', None))
            if plate_texts:
                retry = await blur_service.blur_with_known_text(final_image_data, plate_texts)
                if retry.plates_detected > 0:
                    final_image_data = retry.image_data

        # Store to S3 + DB only when a car was detected (blurred image stored)
        identification_id = None
        image_url = None
        if store_results and result.is_car:
            storage_service = CarStorageService(
                db_session=db,
                s3_bucket=aws_bucket_name or "carid-images",
            )
            identification_id = await storage_service.store_identification_result(
                image_filename=image.filename or "car_image.jpg",
                image_data=final_image_data,
                result=result,
                user_id=current_user.id if current_user else None,
                latitude=latitude,
                longitude=longitude,
            )
            # Generate presigned URL so the client can display the stored image immediately
            if identification_id:
                db_car = (
                    db.query(CarIdentification)
                    .filter(CarIdentification.id == identification_id)
                    .first()
                )
                if db_car and db_car.s3_image_key:
                    try:
                        image_url = s3_client.generate_presigned_url(
                            'get_object',
                            Params={
                                'Bucket': aws_bucket_name or 'carid-images',
                                'Key': db_car.s3_image_key,
                            },
                            ExpiresIn=3600,
                        )
                    except Exception:
                        base_url = str(request.base_url).rstrip('/')
                        image_url = f"{base_url}/api/v1/cars/identifications/{identification_id}/image"

        # Increment weekly camera usage counter now that identification succeeded
        stats.weekly_count += 1
        db.commit()

        # Award any newly-crossed badges (fires only when a car was successfully identified)
        newly_awarded_badges: list[dict] = []
        if result.is_car and current_user:
            try:
                awarded_ids = check_and_award_badges(db, current_user.id)
                if awarded_ids:
                    awarded_badge_rows = db.query(Badge).filter(Badge.id.in_(awarded_ids)).all()
                    for b in awarded_badge_rows:
                        badge_image_url = None
                        if b.s3_key:
                            try:
                                badge_image_url = s3_client.generate_presigned_url(
                                    'get_object',
                                    Params={'Bucket': aws_bucket_name or 'carid-images', 'Key': b.s3_key},
                                    ExpiresIn=3600 * 24 * 7,
                                )
                            except Exception:
                                pass
                        newly_awarded_badges.append({
                            'id': b.id,
                            'name': b.name,
                            'required_images': b.required_images,
                            'image_url': badge_image_url,
                        })
            except Exception as _badge_exc:
                # Badge award failure must never break the identification response
                logger.warning("Badge award failed: %s", _badge_exc)

        # Build response
        response_data: dict = {
            "success": True,
            "identification_id": identification_id,
            "image_url": image_url,
            "filename": image.filename,
            "is_car": result.is_car,
            "newly_awarded_badges": newly_awarded_badges,
        }

        if result.is_car:
            car_data: dict = {}
            for field_name in ['make', 'model', 'description', 'year', 'length',
                                'car_type', 'body_type', 'features', 'car_rarity']:
                value = getattr(result, field_name)
                if value is not None and (not fields or field_name in fields):
                    car_data[field_name] = value
            if result.make_source:
                car_data["make_source"] = result.make_source

            # Fetch third-party statistics for the identified make/model
            car_statistics = None
            if result.make and result.model:
                try:
                    stats_service = CarStorageService(
                        db_session=db,
                        s3_bucket=aws_bucket_name or "carid-images",
                    )
                    car_statistics = stats_service.get_or_fetch_car_details(result.make, result.model)
                except Exception as _stats_exc:
                    logger.warning("Car statistics fetch failed: %s", _stats_exc)

            response_data.update({
                "car_details": car_data,
                "confidence": result.confidence,
                "car_statistics": car_statistics,
            })
        else:
            response_data.update({
                "message": "No car detected in the image",
                "confidence": result.confidence,
            })
            if result.description:
                response_data["description"] = result.description

        return JSONResponse(content=response_data, status_code=200)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected error during identification")


@router.post("/identify/stream", response_class=StreamingResponse)
@limiter.limit("20/minute")
async def identify_car_from_image_streaming(
    request: Request,
    image: UploadFile = File(..., description="Image file to analyze"),
    requested_fields: Optional[str] = Form(
        ['make', 'model', 'description', 'year', 'length', 'car_type', 'body_type', 'features'],
        description="Comma-separated list of fields to return",
    ),
    store_results: bool = Form(True, description="Whether to store results in database"),
    latitude: Optional[float] = Form(None, description="Latitude of where the photo was taken"),
    longitude: Optional[float] = Form(None, description="Longitude of where the photo was taken"),
    identifier: AnthropicCarIdentifier = Depends(get_car_identifier),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Legacy single-pass identify endpoint (no make-hint pipeline).
    Kept for backwards compatibility; prefer POST /identify.
    """

    allowed_types = ['image/jpeg', 'image/jpg', 'image/png']
    if image.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Supported types: {', '.join(allowed_types)}",
        )

    max_size = 10 * 1024 * 1024
    if image.size and image.size > max_size:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    try:
        image_data = await image.read()

        fields: list[str] = []
        if requested_fields:
            fields = [f.strip() for f in requested_fields.split(',') if f.strip()]

        result = await identifier.identify_car(image_data, fields)

        identification_id = None
        if store_results:
            if result.is_car:
                image_data = blur_license_plates(image_data)
            storage_service = CarStorageService(
                db_session=db,
                s3_bucket=aws_bucket_name or "carid-images",
            )
            identification_id = await storage_service.store_identification_result(
                image_filename=image.filename or "car_image.jpg",
                image_data=image_data,
                result=result,
                user_id=current_user.id if current_user else None,
                latitude=latitude,
                longitude=longitude,
            )

        response_data: dict = {
            "success": True,
            "identification_id": identification_id,
            "filename": image.filename,
            "is_car": result.is_car,
        }

        if result.is_car:
            car_data: dict = {}
            for field_name in ['make', 'model', 'description', 'year', 'length',
                                'car_type', 'body_type', 'features']:
                value = getattr(result, field_name)
                if value is not None and (not fields or field_name in fields):
                    car_data[field_name] = value
            response_data.update({"car_details": car_data, "confidence": result.confidence})
        else:
            response_data.update({
                "message": "No car detected in the image",
                "confidence": result.confidence,
            })
            if result.description:
                response_data["description"] = result.description

        return JSONResponse(content=response_data, status_code=200)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected error during identification")
