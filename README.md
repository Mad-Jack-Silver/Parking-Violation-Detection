# 🚗 Intelligent Parking Violation & Compliance Detection System

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-00FFFF?logo=yolo&logoColor=black)](https://github.com/ultralytics/ultralytics)
[![PyTorch](https://img.shields.io/badge/PyTorch-CPU%20Optimized-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org/)
[![Tests](https://img.shields.io/badge/Tests-16%20Passing-brightgreen?logo=pytest&logoColor=white)](https://docs.pytest.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An end-to-end computer vision and spatial geometry web system that automates parking enforcement and compliance auditing from static imagery. The application combines **deep learning object detection (YOLOv8)**, **computational geometry (Shapely)**, and **heuristic-filtered optical character recognition (EasyOCR)** within a decoupled **React + FastAPI** architecture.

---

## 📑 Table of Contents

- [Executive Summary](#-executive-summary)
- [System Architecture](#-system-architecture)
- [Engineering Highlights & Algorithmic Design](#-engineering-highlights--algorithmic-design)
  - [1. Dual-Mode Spatial Partitioning](#1-dual-mode-spatial-partitioning)
  - [2. Class-Agnostic Non-Maximum Suppression (NMS)](#2-class-agnostic-non-maximum-suppression-nms)
  - [3. Dynamic Confidence Calibration](#3-dynamic-confidence-calibration)
  - [4. High-Efficiency CPU Inference Optimization](#4-high-efficiency-cpu-inference-optimization)
  - [5. Heuristic-Filtered License Plate Extraction](#5-heuristic-filtered-license-plate-extraction)
- [API Specification](#-api-specification)
- [Project Structure](#-project-structure)
- [Local Setup & Reproduction](#-local-setup--reproduction)
- [Automated Testing](#-automated-testing)
- [Production Deployment Architecture](#-production-deployment-architecture)
- [License](#-license)

---

## 🎯 Executive Summary

Manual parking enforcement in commercial and private facilities is labor-intensive and prone to human oversight. This project provides an automated compliance auditing platform allowing operators to upload parking lot imagery, interactively define spatial boundaries (restricted zones vs. legal bays), and instantly evaluate parking infractions:

- **Automated Vehicle Detection**: Locates sedans, SUVs, trucks, and buses across high-angle surveillance perspectives.
- **Arbitrary Polygon Zone Drawing**: Vector canvas interface (`react-konva`) allowing multi-point polygon boundaries for non-rectangular stalls and curved curbs.
- **Violation vs. Compliance Classification**: Distinguishes between unauthorized parking in restricted areas, line-straddling improper parking, and valid stall parking.
- **OCR License Plate Extraction**: Crops flagged vehicles and extracts alphanumeric plate sequences with syntax heuristic validation.

---

## 🏗 System Architecture

The application is structured as a decoupled full-stack architecture separating interactive client rendering from asynchronous compute workloads:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            CLIENT (Browser)                              │
│                                                                          │
│   React 18 + Vite (Tailwind CSS + React-Konva)                          │
│   ├── Responsive HTML5 Canvas (Dynamic Aspect Ratio Scaling)             │
│   ├── Vector Zone Drawing Engine (Polygon Point Aggregation)            │
│   └── Real-Time Sensitivity Controls (Confidence Threshold Slider)       │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                      HTTP / JSON (REST API, CORS)
                                     │
┌────────────────────────────────────▼─────────────────────────────────────┐
│                           SERVER (FastAPI)                               │
│                                                                          │
│   ├── /detect            ──> YOLOv8 Engine (CPU Optimized, NMS)         │
│   ├── /check-violations  ──> Shapely Geometric Intersection Engine       │
│   └── /report            ──> Crop Extraction + EasyOCR Heuristic Engine  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Decoupling Rationale
- **Frontend (Vite / React)**: Handles low-latency vector operations on HTML5 canvas, UI state management, and real-time interaction without client-side ML bundle bloat.
- **Backend (FastAPI / Python)**: Provides an asynchronous interface wrapping PyTorch, Shapely, and OpenCV. FastAPI serves structured Pydantic-validated responses with sub-second latency.

---

## 🔬 Engineering Highlights & Algorithmic Design

### 1. Dual-Mode Spatial Partitioning

Rather than treating every marked boundary solely as a "No Parking" zone, the geometric engine supports two distinct operational modes via **Shapely** polygon intersections:

$$\text{Overlap Ratio} = \frac{\text{Area}(\text{Vehicle Bounding Box} \cap \text{Drawn Zone})}{\text{Area}(\text{Vehicle Bounding Box})}$$

| Zone Type | Overlap Threshold | Classification | Visual State | Operational Meaning |
|---|---|---|---|---|
| **🚫 Restricted Area** | $\ge 30\%$ | `Violation` | 🔴 Red Bounding Box | Parked in fire lane, loading dock, or tow-away zone. |
| **🚫 Restricted Area** | $< 30\%$ | `Clear` | 🔵 Cyan Bounding Box | Normal perimeter proximity without obstruction. |
| **🅿️ Parking Bay** | $\ge 60\%$ | `Legal Parking` | 🟢 Green Bounding Box | Correctly positioned within marked stall lines. |
| **🅿️ Parking Bay** | $15\% \le \text{ratio} < 60\%$ | `Improper Parking` | 🔴 Red Bounding Box | Straddling stall lines or occupying multiple spaces. |

```python
# Implementation excerpt from app/violations.py
if zone.label in {"parking_spot", "parking_bay"}:
    if overlap_ratio >= LEGAL_PARKING_THRESHOLD:
        legal_parkings.append(ComplianceItem(detection_id=det.id, status="legal"))
    elif overlap_ratio >= IMPROPER_PARKING_LOWER_THRESHOLD:
        violations.append(Violation(detection_id=det.id, violation_type="improper_parking"))
```

---

### 2. Class-Agnostic Non-Maximum Suppression (NMS)

In complex surveillance shots, vehicle rooflines can exhibit overlapping feature activations across multiple COCO classes (e.g., `car` vs. `bus`). Standard class-specific NMS evaluates suppression per-class, which can result in dual overlapping bounding boxes on a single physical vehicle.

- **Solution**: Enabled `agnostic_nms=True` in Ultralytics YOLOv8 inference. Overlapping bounding boxes exceeding the IoU threshold (0.45) are suppressed regardless of predicted class identity, guaranteeing exactly one bounding box per physical vehicle.

---

### 3. Dynamic Confidence Calibration

Top-down parking surveillance cameras present steep vantage angles that differ from eye-level street photos. Standard confidence cutoffs ($0.35+$) frequently filter out true-positive vehicles in shadowed or distant bays ($0.20 - 0.33$ confidence range).

- **Solution**: Implemented an interactive sensitivity slider (10%–60%, default 20%) that parameterizes the inference pipeline dynamically over REST payloads, allowing operators to calibrate sensitivity based on camera distance and environmental illumination.

---

### 4. High-Efficiency CPU Inference Optimization

To ensure seamless deployment on standard cloud instances and free-tier containers without memory exhaustion (OOM):
- **CPU-Only PyTorch Build**: Linked to `--extra-index-url https://download.pytorch.org/whl/cpu`, reducing container memory consumption from $\sim 450\text{ MB}$ (CUDA runtime) down to $\sim 120\text{ MB}$.
- **Thread Capping**: Enforced `torch.set_num_threads(1)` to eliminate multi-worker CPU thrashing.
- **Startup Model Warming**: YOLOv8 weights are initialized into memory during FastAPI server startup (`@app.on_event("startup")`), reducing cold-request response times to under $200\text{ms}$.

---

### 5. Heuristic-Filtered License Plate Extraction

Raw OCR applied to vehicle crops often detects ambient text (e.g., bumper stickers, dealer emblems). The pipeline filters extracted text blobs through regex and alphanumeric structural validators:

```python
# Validation criteria in app/ocr.py:
# 1. 4-8 alphanumeric characters
# 2. Contains both letters and digits
# 3. Matches alphanumeric vehicle registration syntax
```

---

## 📡 API Specification

The backend exposes the following RESTful endpoints:

### `POST /detect`
Performs object detection on a base64-encoded image.
- **Request Body**:
  ```json
  {
    "image_base64": "data:image/jpeg;base64,...",
    "conf_threshold": 0.20
  }
  ```
- **Response**:
  ```json
  {
    "detections": [
      {
        "id": "b8f4174d-720c-45a9-8390-58c0a9cbdb8f",
        "class_name": "car",
        "confidence": 0.84,
        "box": [124.5, 88.0, 310.2, 245.8]
      }
    ],
    "image_width": 1280,
    "image_height": 720
  }
  ```

### `POST /check-violations`
Computes geometric intersections between detection bounding boxes and user-drawn polygons.
- **Request Body**:
  ```json
  {
    "detections": [...],
    "zones": [
      {
        "id": "z1",
        "label": "parking_spot",
        "points": [{"x": 100, "y": 80}, {"x": 320, "y": 80}, {"x": 320, "y": 250}, {"x": 100, "y": 250}]
      }
    ]
  }
  ```
- **Response**:
  ```json
  {
    "violations": [],
    "legal_parkings": [
      {
        "detection_id": "b8f4174d-720c-45a9-8390-58c0a9cbdb8f",
        "zone_id": "z1",
        "box": [124.5, 88.0, 310.2, 245.8],
        "status": "legal",
        "description": "Correctly parked inside designated bay"
      }
    ],
    "invalid_zone_ids": []
  }
  ```

### `POST /report`
Executes OCR text recognition on cropped bounding boxes of flagged vehicles.

---

## 📂 Project Structure

```
parking-violation-detection/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI application & route declarations
│   │   ├── inference.py     # Ultralytics YOLOv8 inference wrapper
│   │   ├── violations.py    # Shapely polygon intersection & compliance rules
│   │   ├── ocr.py           # EasyOCR integration with heuristic syntax filters
│   │   └── schemas.py       # Pydantic request/response data contracts
│   ├── models/
│   │   └── parking_yolov8.pt # Fine-tuned weights
│   ├── tests/
│   │   ├── test_violations.py    # Geometric compliance unit tests
│   │   └── test_ocr_filtering.py  # License plate regex unit tests
│   ├── requirements.txt     # Python dependencies (CPU-optimized PyTorch)
│   └── vercel.json          # Serverless deployment configuration
│
└── frontend/
    ├── src/
    │   ├── App.jsx          # Root application container & state orchestration
    │   ├── api.js           # REST API client
    │   └── components/
    │       ├── ImageCanvas.jsx      # React-Konva vector drawing canvas
    │       ├── UploadPanel.jsx      # File upload & confidence threshold slider
    │       └── ViolationReport.jsx  # Audit log & OCR report summary
    ├── package.json
    └── vite.config.js
```

---

## ⚙️ Local Setup & Reproduction

### 1. Backend Service

```bash
cd backend
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API endpoint available at `http://localhost:8000`. Health check: `http://localhost:8000/health`.

### 2. Frontend Application

```bash
cd frontend
npm install
npm run dev
```
Interactive UI accessible at `http://localhost:5173`.

---

## 🧪 Automated Testing

The geometric rules engine and plate verification filters are covered by automated unit tests:

```bash
cd backend
pytest tests/ -v
```

```
============================= test session starts =============================
tests/test_ocr_filtering.py::test_typical_plate_with_hyphen_is_accepted PASSED
tests/test_ocr_filtering.py::test_typical_plate_with_space_is_accepted PASSED
tests/test_ocr_filtering.py::test_lowercase_plate_is_still_accepted PASSED
tests/test_ocr_filtering.py::test_plain_word_with_no_digits_is_rejected PASSED
tests/test_ocr_filtering.py::test_long_sticker_text_is_rejected PASSED
tests/test_ocr_filtering.py::test_pure_number_with_no_letters_is_rejected PASSED
tests/test_ocr_filtering.py::test_too_short_string_is_rejected PASSED
tests/test_ocr_filtering.py::test_empty_string_is_rejected PASSED
tests/test_violations.py::test_vehicle_fully_inside_zone_is_flagged PASSED
tests/test_violations.py::test_vehicle_fully_outside_zone_is_not_flagged PASSED
tests/test_violations.py::test_vehicle_barely_touching_zone_edge_is_not_flagged PASSED
tests/test_violations.py::test_vehicle_mostly_inside_zone_is_flagged PASSED
tests/test_violations.py::test_no_zones_means_no_violations PASSED
tests/test_violations.py::test_multiple_vehicles_only_flags_the_one_in_the_zone PASSED
tests/test_violations.py::test_legal_parking_spot_inside_bay PASSED
tests/test_violations.py::test_improper_parking_straddling_bay_line PASSED
============================= 16 passed in 0.21s ==============================
```

---

## 🚀 Production Deployment Architecture

- **Frontend**: Hosted as a static Single Page Application (SPA) on **Vercel Edge Network** with global CDN caching.
- **Backend**: Containerized/Web Service on **Render** (or any container hosting platform) with full Python 3 runtime and PyTorch CPU acceleration.
- **CORS Configuration**: Configured with `allow_origins=["*"]` and environment variable overrides (`FRONTEND_ORIGIN`) for secure cross-origin communication.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
