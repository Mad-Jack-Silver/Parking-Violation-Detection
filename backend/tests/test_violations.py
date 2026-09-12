import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.schemas import Detection, Zone, Point
from app.violations import check_violations


def make_detection(box, det_id="d1"):
    return Detection(id=det_id, class_name="car", confidence=0.9, box=box)


def make_square_zone(x1, y1, x2, y2, zone_id="z1", label="no-parking"):
    return Zone(
        id=zone_id,
        label=label,
        points=[Point(x=x1, y=y1), Point(x=x2, y=y1), Point(x=x2, y=y2), Point(x=x1, y=y2)],
    )


def test_vehicle_fully_inside_zone_is_flagged():
    detections = [make_detection([10, 10, 50, 50])]
    zones = [make_square_zone(0, 0, 100, 100)]
    violations, legal = check_violations(detections, zones)
    assert len(violations) == 1
    assert violations[0].detection_id == "d1"
    assert violations[0].violation_type == "restricted_zone"
    assert len(legal) == 0


def test_vehicle_fully_outside_zone_is_not_flagged():
    detections = [make_detection([200, 200, 250, 250])]
    zones = [make_square_zone(0, 0, 100, 100)]
    violations, legal = check_violations(detections, zones)
    assert len(violations) == 0
    assert len(legal) == 0


def test_vehicle_barely_touching_zone_edge_is_not_flagged():
    # Only a sliver overlaps -> below the 0.3 overlap-ratio threshold
    detections = [make_detection([95, 95, 145, 145])]
    zones = [make_square_zone(0, 0, 100, 100)]
    violations, legal = check_violations(detections, zones)
    assert len(violations) == 0


def test_vehicle_mostly_inside_zone_is_flagged():
    # box is 60x100=6000 area; overlap with the 0,0-100,100 zone is
    # 60x80=4800 -> 80% overlap ratio -> above threshold
    detections = [make_detection([20, 20, 80, 120])]
    zones = [make_square_zone(0, 0, 100, 100)]
    violations, legal = check_violations(detections, zones)
    assert len(violations) == 1


def test_no_zones_means_no_violations():
    detections = [make_detection([10, 10, 50, 50])]
    violations, legal = check_violations(detections, [])
    assert violations == []
    assert legal == []


def test_multiple_vehicles_only_flags_the_one_in_the_zone():
    detections = [
        make_detection([10, 10, 50, 50], det_id="inside"),
        make_detection([300, 300, 350, 350], det_id="outside"),
    ]
    zones = [make_square_zone(0, 0, 100, 100)]
    violations, legal = check_violations(detections, zones)
    assert len(violations) == 1
    assert violations[0].detection_id == "inside"


def test_legal_parking_spot_inside_bay():
    # Car fully inside a designated parking spot
    detections = [make_detection([10, 10, 50, 50], det_id="parked_well")]
    zones = [make_square_zone(0, 0, 60, 60, zone_id="bay1", label="parking_spot")]
    violations, legal = check_violations(detections, zones)
    assert len(violations) == 0
    assert len(legal) == 1
    assert legal[0].detection_id == "parked_well"
    assert legal[0].status == "legal"


def test_improper_parking_straddling_bay_line():
    # Car only partially inside bay (e.g. 30% inside) -> improper parking violation
    detections = [make_detection([40, 10, 100, 50], det_id="straddler")]  # width 60, height 40 -> area 2400. Overlap with 0..60 is 20x40=800 -> 33%
    zones = [make_square_zone(0, 0, 60, 60, zone_id="bay1", label="parking_spot")]
    violations, legal = check_violations(detections, zones)
    assert len(violations) == 1
    assert violations[0].violation_type == "improper_parking"
    assert len(legal) == 0
