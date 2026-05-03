import io
import logging
import os
import re
from dataclasses import dataclass, field
from typing import List

import boto3
from botocore.exceptions import ClientError
from PIL import Image, ImageFilter

logger = logging.getLogger("carid.license_plate")

_DEFAULT_BLUR_RADIUS = 20
# Rekognition inline-bytes hard limit is 5 MB
_REKOGNITION_MAX_BYTES = 5 * 1024 * 1024
# Rekognition may use either label name depending on the model version/region
_LICENSE_PLATE_LABEL_NAMES = {"License Plate", "Vehicle Registration Plate"}
# Regex that matches typical license plate text: 4-10 uppercase alphanumeric chars (spaces allowed)
_PLATE_TEXT_RE = re.compile(r'^[A-Z0-9][A-Z0-9 \-\.]{2,9}[A-Z0-9]$')


@dataclass
class BlurResult:
    image_data: bytes
    plates_detected: int
    detection_method: str          # "detect_labels", "detect_text_fallback", "none", "error"
    all_labels: List[str] = field(default_factory=list)   # "Name:Confidence" from detect_labels
    text_lines_found: List[str] = field(default_factory=list)  # LINE texts from detect_text fallback
    error: str = ""


class LicensePlateBlurService:
    def __init__(self, aws_region: str):
        self._rekognition = boto3.client("rekognition", region_name=aws_region)
        self._blur_radius = int(os.getenv("BLUR_RADIUS", _DEFAULT_BLUR_RADIUS))

    def _prepare_for_rekognition(self, image_data: bytes) -> bytes:
        """
        Rekognition has a 5 MB inline-bytes limit.
        If the image exceeds this, compress it to JPEG at progressively lower
        quality until it fits, then return the compressed bytes.
        The original image_data is never modified.
        """
        if len(image_data) <= _REKOGNITION_MAX_BYTES:
            return image_data

        img = Image.open(io.BytesIO(image_data)).convert("RGB")
        for quality in (85, 70, 55, 40):
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=quality)
            compressed = buf.getvalue()
            if len(compressed) <= _REKOGNITION_MAX_BYTES:
                logger.debug(
                    "Image compressed to %d bytes (quality=%d) for Rekognition",
                    len(compressed),
                    quality,
                )
                return compressed

        # Last resort: halve the resolution
        w, h = img.size
        img = img.resize((w // 2, h // 2), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=70)
        return buf.getvalue()

    def _boxes_from_detect_labels(self, rekognition_bytes: bytes) -> tuple[list, list, str]:
        """
        Call detect_labels and return (bounding_boxes, all_label_strings, error_msg).
        Confidence threshold intentionally low (20) to maximise recall.
        """
        try:
            response = self._rekognition.detect_labels(
                Image={"Bytes": rekognition_bytes},
                MinConfidence=20,
            )
        except ClientError as exc:
            return [], [], f"detect_labels ClientError: {exc}"
        except Exception as exc:
            return [], [], f"detect_labels error: {exc}"

        all_labels = [
            f"{lbl['Name']}:{lbl['Confidence']:.1f}"
            for lbl in response.get("Labels", [])
        ]

        bounding_boxes = []
        for label in response.get("Labels", []):
            if label.get("Name") in _LICENSE_PLATE_LABEL_NAMES:
                for instance in label.get("Instances", []):
                    box = instance.get("BoundingBox")
                    if box:
                        bounding_boxes.append(box)

        return bounding_boxes, all_labels, ""

    def _boxes_from_detect_text(self, rekognition_bytes: bytes) -> tuple[list, list, str]:
        """
        Fallback: call detect_text and return bounding boxes for LINE detections
        that match a license-plate-like alphanumeric pattern.
        Also returns the raw LINE texts found for diagnostic purposes.
        """
        try:
            response = self._rekognition.detect_text(
                Image={"Bytes": rekognition_bytes},
            )
        except ClientError as exc:
            return [], [], f"detect_text ClientError: {exc}"
        except Exception as exc:
            return [], [], f"detect_text error: {exc}"

        bounding_boxes = []
        line_texts = []
        for detection in response.get("TextDetections", []):
            if detection.get("Type") != "LINE":
                continue
            text = detection.get("DetectedText", "").strip().upper()
            line_texts.append(f"{text}:{detection.get('Confidence', 0):.1f}")
            if _PLATE_TEXT_RE.match(text):
                box = detection.get("Geometry", {}).get("BoundingBox")
                if box:
                    bounding_boxes.append(box)

        return bounding_boxes, line_texts, ""

    def _apply_blur(self, image_data: bytes, bounding_boxes: list, content_type: str) -> bytes:
        """Apply Gaussian blur to all bounding box regions on the original full-res image."""
        img = Image.open(io.BytesIO(image_data)).convert("RGBA")
        width, height = img.size

        for box in bounding_boxes:
            left = max(0, int(box["Left"] * width))
            top = max(0, int(box["Top"] * height))
            right = min(width, int((box["Left"] + box["Width"]) * width))
            bottom = min(height, int((box["Top"] + box["Height"]) * height))

            region = img.crop((left, top, right, bottom))
            blurred = region.filter(ImageFilter.GaussianBlur(radius=self._blur_radius))
            img.paste(blurred, (left, top))

        output_format = "JPEG" if content_type in ("image/jpeg", "image/jpg") else "PNG"
        img = img.convert("RGB" if output_format == "JPEG" else "RGBA")
        buf = io.BytesIO()
        img.save(buf, format=output_format)
        return buf.getvalue()

    async def blur_license_plates(
        self, image_data: bytes, content_type: str = "image/jpeg"
    ) -> BlurResult:
        """
        Detect license plates and blur them. Returns a BlurResult with full diagnostics.
        Falls back to detect_text when detect_labels finds nothing.
        """
        rekognition_bytes = self._prepare_for_rekognition(image_data)

        # --- Primary: detect_labels ---
        boxes, all_labels, err = self._boxes_from_detect_labels(rekognition_bytes)
        logger.info("detect_labels returned %d label(s): %s", len(all_labels), all_labels)

        if err:
            logger.warning(err)

        if boxes:
            try:
                blurred = self._apply_blur(image_data, boxes, content_type)
                return BlurResult(
                    image_data=blurred,
                    plates_detected=len(boxes),
                    detection_method="detect_labels",
                    all_labels=all_labels,
                )
            except Exception as exc:
                logger.warning("Blur application failed: %s", exc)
                return BlurResult(
                    image_data=image_data, plates_detected=0,
                    detection_method="error", all_labels=all_labels, error=str(exc),
                )

        # --- Fallback: detect_text ---
        logger.info(
            "detect_labels found no plate boxes (all labels: %s) — trying detect_text fallback",
            all_labels,
        )
        text_boxes, line_texts, text_err = self._boxes_from_detect_text(rekognition_bytes)
        logger.info("detect_text LINE results: %s", line_texts)

        if text_err:
            logger.warning(text_err)

        if text_boxes:
            try:
                blurred = self._apply_blur(image_data, text_boxes, content_type)
                return BlurResult(
                    image_data=blurred,
                    plates_detected=len(text_boxes),
                    detection_method="detect_text_fallback",
                    all_labels=all_labels,
                    text_lines_found=line_texts,
                )
            except Exception as exc:
                logger.warning("Blur application (text fallback) failed: %s", exc)
                return BlurResult(
                    image_data=image_data, plates_detected=0,
                    detection_method="error", all_labels=all_labels,
                    text_lines_found=line_texts, error=str(exc),
                )

        return BlurResult(
            image_data=image_data,
            plates_detected=0,
            detection_method="none",
            all_labels=all_labels,
            text_lines_found=line_texts,
            error=err or text_err,
        )

    async def blur_with_known_text(
        self, image_data: bytes, plate_texts: list
    ) -> BlurResult:
        """
        Targeted fallback: use Rekognition detect_text to locate and blur regions
        that match known plate text strings identified by Claude.
        Matches are normalised (spaces/dashes stripped) before comparison.
        """
        rekognition_bytes = self._prepare_for_rekognition(image_data)
        try:
            response = self._rekognition.detect_text(Image={"Bytes": rekognition_bytes})
        except Exception as exc:
            return BlurResult(
                image_data=image_data, plates_detected=0,
                detection_method="error", error=str(exc),
            )

        normalized_targets = [re.sub(r'[\s\-]', '', t.upper()) for t in plate_texts]

        bounding_boxes = []
        for detection in response.get("TextDetections", []):
            raw = detection.get("DetectedText", "").upper()
            norm = re.sub(r'[\s\-]', '', raw)
            if any(
                (tgt in norm or norm in tgt)
                for tgt in normalized_targets
                if len(tgt) >= 3
            ):
                box = detection.get("Geometry", {}).get("BoundingBox")
                if box:
                    bounding_boxes.append(box)

        if bounding_boxes:
            try:
                blurred = self._apply_blur(image_data, bounding_boxes, "image/jpeg")
                return BlurResult(
                    image_data=blurred,
                    plates_detected=len(bounding_boxes),
                    detection_method="known_text_match",
                )
            except Exception as exc:
                return BlurResult(
                    image_data=image_data, plates_detected=0,
                    detection_method="error", error=str(exc),
                )

        return BlurResult(image_data=image_data, plates_detected=0, detection_method="none")
