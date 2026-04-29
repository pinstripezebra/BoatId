from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from models.car_details import CarDetails
from utils.database import get_db
from services.storage_service import CarStorageService
import os

router = APIRouter()


@router.get("/{make}/{model}", summary="Get car statistics for a make/model")
async def get_car_statistics(
    make: str,
    model: str,
    db: Session = Depends(get_db),
):
    """
    Return engine and efficiency statistics for a given make/model combination.

    Data is sourced from the API-Ninjas /v1/cars endpoint and cached in the
    local `car_details` table.  If no data exists yet for this combination,
    the API is queried on-demand and the result is persisted.
    """
    # Use a lightweight CarStorageService (no S3 bucket needed for reads)
    service = CarStorageService(
        db_session=db,
        s3_bucket=os.getenv("AWS_BUCKET_NAME", "carid-images"),
    )
    details = service.get_or_fetch_car_details(make.strip(), model.strip())

    if details is None:
        raise HTTPException(status_code=404, detail="No statistics found for this make/model")

    return {"make": make, "model": model, "statistics": details}
