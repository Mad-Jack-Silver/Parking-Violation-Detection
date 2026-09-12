# 🚗 Intelligent Parking Violation & Compliance Detection System

An end-to-end Computer Vision web application that detects vehicles in parking lot imagery, allows operators to interactively mark **Restricted Zones** (no-parking areas, fire lanes) and **Designated Parking Bays** (legal spots), and automatically audits parking compliance — flagging boundary violations, line straddling, and running license plate recognition (OCR).

---

## 📌 Table of Contents
1. [Key Features](#-key-features)
2. [System Architecture](#-system-architecture)
   - [Why React + FastAPI?](#why-react--fastapi)
   - [Why Two Different Servers in Development?](#why-two-different-servers-in-development)
3. [Computer Vision & Detection Insights](#-computer-vision--detection-insights)
   - [Why Were Some Cars Missed? (Confidence Threshold)](#1-why-were-some-cars-missed-confidence-threshold)
   - [Why Did One Car Have Multiple Violation Boxes? (Class-Agnostic NMS)](#2-why-did-one-car-have-multiple-violation-boxes-class-agnostic-nms)
   - [Why Are Some Cars Labeled as "Bus"? (COCO Perspective Bias)](#3-why-are-some-cars-labeled-as-bus-coco-perspective-bias)
   - [Dataset Breakdown: The Roboflow Training Data Nuance](#4-dataset-breakdown-the-roboflow-training-data-nuance)
4. [Compliance & Violation Rules Engine](#-compliance--violation-rules-engine)
5. [Local Development Setup](#-local-development-setup)
6. [Step-by-Step Guide: Pushing to GitHub](#-step-by-step-guide-pushing-to-github)
7. [Deploying Live on Vercel](#-deploying-live-on-vercel)
   - [Will It Stay Live 24/7 Like My Portfolio?](#will-it-stay-live-247-like-my-portfolio)
   - [Understanding Serverless Cold Starts](#understanding-serverless-cold-starts)
   - [Deploying the Frontend](#step-1-deploy-the-frontend)
   - [Deploying the Backend](#step-2-deploy-the-backend)
   - [Connecting Frontend & Backend via CORS](#step-3-connect-them-together)
   - [Alternative Free Backend Hosts for Heavy ML](#alternative-free-backend-hosts-for-heavy-ml)

---

## 🌟 Key Features

- **Interactive Canvas Drawing (`react-konva`)**: Click points directly on any parking lot image to define arbitrary polygon boundaries.
- **Dual Zone Modes**:
  - 🚫 **Restricted Area**: Marks no-parking zones, fire lanes, or loading docks. Any vehicle parked inside is flagged as a violation.
  - 🅿️ **Parking Bay**: Marks legal parking spots. Vehicles properly parked inside are verified as **Legal Parking (Green)**; vehicles straddling lines are flagged for improper parking.
- **Dynamic Sensitivity Slider**: Adjust YOLO detection confidence (10%–60%) in real time to capture small, shadowed, or distant vehicles without false alarms.
- **Class-Agnostic Non-Maximum Suppression (NMS)**: Eliminates duplicate overlapping bounding boxes on the same physical vehicle.
- **Responsive Aspect-Ratio Preservation**: Automatically scales the canvas to match the uploaded photo's true aspect ratio without image distortion.
- **Automated License Plate Reading**: Crops violating vehicles and applies **EasyOCR** with shape/syntax heuristic filtering to extract vehicle plates.

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT BROWSER                       │
│                                                         │
│   React (Vite) UI  <─────── Canvas Zone Drawing         │
│   - Image preview            - Polygon points           │
│   - Confidence slider        - Status-aware color boxes │
└──────────────┬────────────────────────────▲─────────────┘
               │ HTTP POST /detect          │ JSON Detections
               │ HTTP POST /check-violation │ & Violations
               ▼                            │
┌───────────────────────────────────────────┴─────────────┐
│                 BACKEND REST API (FastAPI)              │
│                                                         │
│   ├── YOLOv8 Engine   ──> Vehicle Detection & Bounding  │
│   ├── Shapely Engine  ──> Polygon Intersection Geometry │
│   └── EasyOCR Engine  ──> License Plate Text Extraction │
└─────────────────────────────────────────────────────────┘
```

### Why React + FastAPI?

- **React (Frontend)**: Runs in the user's web browser using JavaScript. Browsers are fantastic for fluid interactive UI (handling mouse clicks, drawing lines on HTML5 canvas, instant slider responsiveness), but browsers **cannot natively execute heavy machine learning models** like PyTorch, YOLOv8, and EasyOCR at high speed.
- **FastAPI (Backend)**: Runs on Python, the native language of AI/ML. FastAPI is an asynchronous, high-performance web framework. It keeps the YOLO model in memory and exposes lightweight REST endpoints (`/detect`, `/check-violations`, `/report`) so the browser can send an image and receive structured JSON results in milliseconds.

### Why Two Different Servers in Development?

When developing locally on your computer:
1. **Frontend runs on `http://localhost:5173`** (managed by **Vite**): Vite provides instant Hot Module Replacement (HMR). When you edit a `.jsx` file, Vite updates your browser instantly without reloading the page.
2. **Backend runs on `http://localhost:8000`** (managed by **Uvicorn**): Uvicorn executes the Python runtime, loads PyTorch/CUDA, and listens for HTTP requests.

Because they run on different ports, the backend uses **CORS (`Cross-Origin Resource Sharing`)** to authorize requests from `http://localhost:5173`.

---

## 🔍 Computer Vision & Detection Insights

### 1. Why Were Some Cars Missed? (Confidence Threshold)
Standard YOLO models are tuned for close-up objects and often output lower confidence scores (**0.20 – 0.34**) for cars captured from surveillance or top-down parking lot angles. 
- *The Problem:* The backend previously had a hardcoded cutoff of `conf_threshold = 0.35`. Any vehicle scoring 0.33 or 0.28 was dropped.
- *The Fix:* We lowered the default confidence to `0.20` and added an interactive **Detection Confidence Slider** (10% to 60%) in the UI so you can adapt to any lighting or camera angle.

### 2. Why Did One Car Have Multiple Violation Boxes? (Class-Agnostic NMS)
YOLO classifies objects across 80 COCO classes (`car`, `bus`, `truck`, etc.). 
- *The Problem:* Standard Non-Maximum Suppression (NMS) is class-specific. If the model predicted that a blue vehicle was 52% likely a `car` and 53% likely a `bus`, both boxes were preserved because they belonged to different classes! This caused two overlapping boxes and counted **2 violations on 1 car**.
- *The Fix:* We enabled `agnostic_nms=True` in `inference.py`. Now, overlapping boxes on the same physical vehicle are merged into a single detection regardless of class prediction.

### 3. Why Are Some Cars Labeled as "Bus"? (COCO Perspective Bias)
The base model `yolov8n.pt` was trained on MS-COCO, which contains ground-level, street-perspective photos. In top-down parking cameras, flat rectangular roofs of sedans and hatchbacks visually resemble mini-buses from above. Our backend groups `car`, `bus`, and `truck` under vehicle classes and allows clean UI labeling.

### 4. Dataset Breakdown: The Roboflow Training Data Nuance
The dataset in `backend/datasets/` was sourced from Roboflow Universe (`parking-violations-lxf0d`), containing images scraped from Reddit `/r/badparking`.
- In these photos, **only the single offending vehicle in the center was annotated**.
- Normally parked cars in the background were left unannotated.
- As a result, fine-tuning heavily on this dataset penalizes the model for detecting background cars. The project therefore provides both the fine-tuned weights (`parking_yolov8.pt`) and the general COCO model (`yolov8n.pt`), seamlessly auto-resolving to the best available weights.

---

## 📐 Compliance & Violation Rules Engine

The backend utilizes **Shapely** polygon geometry to calculate spatial intersections:

$$\text{Overlap Ratio} = \frac{\text{Area}(\text{Vehicle Bounding Box} \cap \text{Drawn Zone})}{\text{Area}(\text{Vehicle Bounding Box})}$$

| Zone Mode | Overlap Ratio | Status | Visual Color | Description |
|---|---|---|---|---|
| **🚫 Restricted Area** | $\ge 30\%$ | **VIOLATION** | Red (`#E4483E`) | Parked in restricted / no-parking zone |
| **🚫 Restricted Area** | $< 30\%$ | Clear | Cyan (`#38BDF8`) | Outside restricted zone |
| **🅿️ Parking Bay** | $\ge 60\%$ | **LEGAL** | Green (`#10B981`) | Correctly parked inside designated spot |
| **🅿️ Parking Bay** | $15\% \le \text{ratio} < 60\%$ | **VIOLATION** | Red (`#E4483E`) | Improper parking (straddling parking line) |

---

## 💻 Local Development Setup

### Prerequisites
- Python 3.10+ (Python 3.11–3.14 supported)
- Node.js 18+ and npm

### 1. Backend Setup
In a terminal, navigate to `backend/`:
```bash
cd backend
python -m venv .venv

# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Backend API will be running at `http://localhost:8000`. Test it by opening `http://localhost:8000/health`.

### 2. Frontend Setup
In a **separate terminal**, navigate to `frontend/`:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Run Automated Tests
```bash
cd backend
pytest tests/ -v
```

---

## 🚀 Step-by-Step Guide: Pushing to GitHub

If you have not initialized a Git repository yet, follow these exact steps in your terminal:

### Step 1: Open PowerShell in the project root
Make sure your terminal is located in:
```powershell
cd c:\Users\Hussain\Desktop\parking-violation-detection
```

### Step 2: Initialize Git & Stage Files
```powershell
git init
git add .
git commit -m "feat: complete parking violation and compliance detection system"
```

> **Note**: The `.gitignore` is pre-configured to exclude large datasets (`backend/datasets/`), temporary training runs (`backend/runs/`), and `node_modules/`, while ensuring your trained model (`backend/models/parking_yolov8.pt`) is preserved.

### Step 3: Create a New Repo on GitHub
1. Go to [github.com/new](https://github.com/new).
2. Enter repository name: `parking-violation-detection`.
3. Choose **Public** (recommended for portfolio display).
4. **Do NOT** initialize with README, .gitignore, or license (we already have them).
5. Click **Create repository**.

### Step 4: Link Remote & Push
Copy the commands shown on your GitHub page and run them:
```powershell
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/parking-violation-detection.git
git push -u origin main
```

---

## ☁️ Deploying Live on Vercel

You can deploy this full-stack project from your GitHub repository onto Vercel using two connected Vercel projects (one for Frontend, one for Backend).

### Will It Stay Live 24/7 Like My Portfolio?
**Yes! Your Vercel URL stays live 24/7/365.** Anyone with your portfolio or project link can access it at any time.

### Understanding Serverless Cold Starts
- **Frontend**: Static Vite files are deployed to Vercel's Edge CDN. When someone visits your site, the page loads instantly in **~10 milliseconds**.
- **Backend**: Runs as a **Vercel Serverless Function**. When no requests have arrived for several minutes, Vercel puts the Python container to sleep to conserve free compute hours.
- **Cold Start**: When a visitor clicks *"Run detection"* after the app has been idle, Vercel spins up the Python container. This first request takes **5–12 seconds** to boot Python and load the YOLO weights into memory. Subsequent detections while warm execute in **~200 milliseconds**.

---

### Step 1: Deploy the Frontend
1. In [Vercel Dashboard](https://vercel.com/dashboard), click **Add New...** → **Project**.
2. Select your `parking-violation-detection` GitHub repo.
3. In **Root Directory**, click edit and select `frontend`.
4. Framework Preset will auto-detect as **Vite**.
5. Click **Deploy**.
6. Once deployed, note down your frontend domain (e.g. `https://parking-detection-ui.vercel.app`).

### Step 2: Deploy the Backend
1. Click **Add New...** → **Project** again, selecting the same GitHub repo.
2. In **Root Directory**, select `backend`.
3. Vercel will detect `vercel.json` and `api/index.py`.
4. In **Environment Variables**, add:
   - `YOLO_MODEL_PATH` = `models/parking_yolov8.pt`
5. Click **Deploy**.
6. Note down your backend URL (e.g. `https://parking-detection-api.vercel.app`).

### Step 3: Connect Them Together
1. Go to your **Frontend** project on Vercel:
   - **Settings** → **Environment Variables** → Add `VITE_API_BASE` = `https://parking-detection-api.vercel.app`.
   - Go to **Deployments** → Click the three dots on the latest deployment → **Redeploy**.
2. Go to your **Backend** project on Vercel:
   - **Settings** → **Environment Variables** → Add `FRONTEND_ORIGIN` = `https://parking-detection-ui.vercel.app`.
   - Go to **Deployments** → **Redeploy**.

---

### Alternative Free Backend Hosts for Heavy ML

> **Tip**: Vercel Serverless Functions have a maximum uncompressed deployment limit of **250MB**. Because PyTorch, Torchvision, and EasyOCR are heavy, deploying full ML models to serverless functions can sometimes exceed serverless quotas.
> 
> If you encounter a bundle size error during backend deployment, the industry standard practice is:
> - **Keep Frontend on Vercel** (lightning-fast CDN, permanently free).
> - **Deploy Backend on a Dedicated Free Container Platform**:
>   - [Render](https://render.com) (Free Web Service — native Python support)
>   - [Railway](https://railway.app)
>   - [Hugging Face Spaces](https://huggingface.co/spaces) (Free Docker container with generous RAM)
>   - Simply paste your Render or Hugging Face API URL into your Vercel frontend's `VITE_API_BASE` variable!

---

## 📜 License
MIT License. Open source and free for academic and portfolio use.
