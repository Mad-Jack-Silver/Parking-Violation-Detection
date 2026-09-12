import os
from ultralytics import YOLO

DATA_YAML = os.path.join(os.path.dirname(__file__), "..", "datasets", "data.yaml")

if __name__ == "__main__":
    if not os.path.exists(DATA_YAML):
        raise SystemExit(
            f"Couldn't find {DATA_YAML} — run scripts/download_dataset.py first."
        )

    model = YOLO("yolov8n.pt")
    model.train(
        data=DATA_YAML,
        epochs=50,
        imgsz=640,
        batch=16,
        name="parking_violation_yolov8",
        device=0,
    )
    print("Training complete. Copy the best.pt weights into backend/models/")
