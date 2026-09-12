import os
import uuid
from typing import List

import numpy as np
import torch
from ultralytics import YOLO

from app.schemas import Detection

# Limit CPU threads to prevent memory spikes on Render free tier (512MB RAM)
torch.set_num_threads(1)

def _resolve_model_path() -> str:
    env_path = os.environ.get("YOLO_MODEL_PATH")
    if env_path and os.path.exists(env_path):
        return env_path
    
    # Check default paths
    local_weights = os.path.join(os.path.dirname(__file__), "..", "yolov8n.pt")
    if os.path.exists(local_weights):
        return local_weights
    
    return "yolov8n.pt"


MODEL_PATH = _resolve_model_path()

VEHICLE_CLASSES = {"car", "truck", "bus", "motorcycle"}

_model = None


def get_model() -> YOLO:
    global _model
    if _model is None:
        _model = YOLO(MODEL_PATH)
    return _model


def detect_vehicles(
    image: np.ndarray,
    conf_threshold: float = 0.20,
    iou_threshold: float = 0.45,
) -> List[Detection]:
    model = get_model()
    # Explicit cpu device and imgsz=640 ensures fast, lightweight execution on Render
    results = model.predict(
        image,
        conf=conf_threshold,
        iou=iou_threshold,
        agnostic_nms=True,
        imgsz=640,
        device="cpu",
        verbose=False,
    )[0]

    detections: List[Detection] = []
    names = results.names
    for box in results.boxes:
        class_id = int(box.cls[0])
        class_name = names[class_id]
        if class_name not in VEHICLE_CLASSES and class_name != "car":
            continue
        x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
        detections.append(
            Detection(
                id=str(uuid.uuid4()),
                class_name=class_name,
                confidence=float(box.conf[0]),
                box=[x1, y1, x2, y2],
            )
        )
    return detections
