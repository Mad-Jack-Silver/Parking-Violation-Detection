from pydantic import BaseModel
from typing import List, Optional


class Point(BaseModel):
    x: float
    y: float


class Zone(BaseModel):
    id: str
    label: str = "restricted"
    points: List[Point] 


class Detection(BaseModel):
    id: str
    class_name: str          
    confidence: float
    box: List[float]         


class DetectRequest(BaseModel):
    image_base64: str
    conf_threshold: Optional[float] = 0.20


class DetectResponse(BaseModel):
    detections: List[Detection]
    image_width: int
    image_height: int


class ViolationCheckRequest(BaseModel):
    detections: List[Detection]
    zones: List[Zone]


class Violation(BaseModel):
    detection_id: str
    zone_id: str
    box: List[float]
    violation_type: str = "restricted_zone"  
    description: Optional[str] = None


class ComplianceItem(BaseModel):
    detection_id: str
    zone_id: str
    box: List[float]
    status: str = "legal"
    description: Optional[str] = "Correctly parked inside bay"


class ViolationCheckResponse(BaseModel):
    violations: List[Violation]
    legal_parkings: List[ComplianceItem] = []
    invalid_zone_ids: List[str] = []


class PlateReadResult(BaseModel):
    detection_id: str
    plate_text: Optional[str] = None
    confidence: Optional[float] = None


class ReportRequest(BaseModel):
    image_base64: str
    detections: List[Detection]
    violations: List[Violation]


class ReportResponse(BaseModel):
    plates: List[PlateReadResult]
    generated_at: str