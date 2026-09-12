from typing import List, Tuple

from shapely.geometry import Polygon, box as shapely_box

from app.schemas import Detection, Zone, Violation, ComplianceItem

RESTRICTED_OVERLAP_THRESHOLD = 0.30
LEGAL_PARKING_THRESHOLD = 0.60
IMPROPER_PARKING_LOWER_THRESHOLD = 0.15


def _zone_to_polygon(zone: Zone) -> Polygon:
    return Polygon([(p.x, p.y) for p in zone.points])


def _is_valid_zone_polygon(zone: Zone) -> bool:
    if len(zone.points) < 3:
        return False
    polygon = _zone_to_polygon(zone)
    return polygon.is_valid and polygon.area > 0


def get_invalid_zone_ids(zones: List[Zone]) -> List[str]:
    return [z.id for z in zones if not _is_valid_zone_polygon(z)]


def check_violations(
    detections: List[Detection], zones: List[Zone]
) -> Tuple[List[Violation], List[ComplianceItem]]:
    violations: List[Violation] = []
    legal_parkings: List[ComplianceItem] = []

    valid_zones = []
    for z in zones:
        if len(z.points) >= 3:
            poly = _zone_to_polygon(z)
            if poly.is_valid and poly.area > 0:
                valid_zones.append((z, poly))

    for det in detections:
        x1, y1, x2, y2 = det.box
        vehicle_poly = shapely_box(x1, y1, x2, y2)
        if vehicle_poly.area == 0:
            continue

        is_violating = False

        for zone, poly in valid_zones:
            if zone.label in {"restricted", "no-parking", "restricted_zone"}:
                intersection = vehicle_poly.intersection(poly)
                overlap_ratio = intersection.area / vehicle_poly.area
                if overlap_ratio >= RESTRICTED_OVERLAP_THRESHOLD:
                    violations.append(
                        Violation(
                            detection_id=det.id,
                            zone_id=zone.id,
                            box=det.box,
                            violation_type="restricted_zone",
                            description="Parked in restricted no-parking zone",
                        )
                    )
                    is_violating = True
                    break

        if is_violating:
            continue

        for zone, poly in valid_zones:
            if zone.label in {"parking_spot", "parking_bay", "legal_bay"}:
                intersection = vehicle_poly.intersection(poly)
                overlap_ratio = intersection.area / vehicle_poly.area
                if overlap_ratio >= LEGAL_PARKING_THRESHOLD:
                    legal_parkings.append(
                        ComplianceItem(
                            detection_id=det.id,
                            zone_id=zone.id,
                            box=det.box,
                            status="legal",
                            description="Correctly parked inside designated bay",
                        )
                    )
                    break
                elif overlap_ratio >= IMPROPER_PARKING_LOWER_THRESHOLD:
                    violations.append(
                        Violation(
                            detection_id=det.id,
                            zone_id=zone.id,
                            box=det.box,
                            violation_type="improper_parking",
                            description=f"Improper parking: straddling line ({int(overlap_ratio * 100)}% inside bay)",
                        )
                    )
                    break

    return violations, legal_parkings