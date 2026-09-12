import base64
import os
from datetime import datetime, timezone
from typing import List

import cv2
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.inference import detect_vehicles
from app.violations import check_violations, get_invalid_zone_ids
from app.schemas import (
    DetectRequest,
    DetectResponse,
    ViolationCheckRequest,
    ViolationCheckResponse,
    ReportRequest,
    ReportResponse,
    PlateReadResult,
)

app = FastAPI(title="Intelligent Parking Violation Detection API")

allow_origins = ["http://localhost:5173", "http://localhost:3000", "*"]
frontend_origin = os.environ.get("FRONTEND_ORIGIN")
if frontend_origin:
    allow_origins.append(frontend_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _decode_image(image_base64: str) -> np.ndarray:
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    raw = base64.b64decode(image_base64)
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    # Resize very large images to max 1280px to keep memory footprint under 300MB on Render
    h, w = img.shape[:2]
    max_dim = max(h, w)
    if max_dim > 1280:
        scale = 1280.0 / max_dim
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


@app.on_event("startup")
def startup_event():
    # Pre-load YOLO model during boot so user requests are instantaneous
    try:
        from app.inference import get_model
        get_model()
    except Exception as e:
        print("Model pre-warm note:", e)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/detect", response_model=DetectResponse)
def detect(req: DetectRequest):
    image = _decode_image(req.image_base64)
    conf = req.conf_threshold if req.conf_threshold is not None else 0.20
    detections = detect_vehicles(image, conf_threshold=conf)
    height, width = image.shape[:2]
    return DetectResponse(detections=detections, image_width=width, image_height=height)


@app.post("/check-violations", response_model=ViolationCheckResponse)
def check(req: ViolationCheckRequest):
    violations, legal_parkings = check_violations(req.detections, req.zones)
    invalid_zone_ids = get_invalid_zone_ids(req.zones)
    return ViolationCheckResponse(
        violations=violations,
        legal_parkings=legal_parkings,
        invalid_zone_ids=invalid_zone_ids,
    )


@app.post("/report", response_model=ReportResponse)
def report(req: ReportRequest):
    image = _decode_image(req.image_base64)
    violating_ids = {v.detection_id for v in req.violations}
    plates: List[PlateReadResult] = []

    from app.ocr import read_plate_text

    for det in req.detections:
        if det.id not in violating_ids:
            continue
        x1, y1, x2, y2 = [int(v) for v in det.box]
        crop = image[max(y1, 0):y2, max(x1, 0):x2]
        if crop.size == 0:
            plates.append(PlateReadResult(detection_id=det.id))
            continue
        text, confidence = read_plate_text(crop)
        plates.append(PlateReadResult(detection_id=det.id, plate_text=text, confidence=confidence))

    return ReportResponse(plates=plates, generated_at=datetime.now(timezone.utc).isoformat())