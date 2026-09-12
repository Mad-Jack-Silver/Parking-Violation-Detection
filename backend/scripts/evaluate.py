import argparse
import os

from ultralytics import YOLO

DATA_YAML = os.path.join(os.path.dirname(__file__), "..", "datasets", "data.yaml")
DEFAULT_WEIGHTS = os.path.join(os.path.dirname(__file__), "..", "models", "parking_yolov8.pt")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--weights", default=DEFAULT_WEIGHTS, help="Path to trained .pt weights")
    parser.add_argument("--data", default=DATA_YAML, help="Path to data.yaml")
    args = parser.parse_args()

    if not os.path.exists(args.weights):
        raise SystemExit(
            f"Couldn't find weights at {args.weights}\n"
            f"Train first with: python scripts/train.py\n"
            f"Or point at different weights with: --weights path/to/your.pt"
        )
    if not os.path.exists(args.data):
        raise SystemExit(f"Couldn't find {args.data} — run scripts/download_dataset.py first.")

    model = YOLO(args.weights)

    metrics = model.val(data=args.data, split="test")

    print("\n=== Held-out TEST set results (not seen during training) ===")
    print(f"mAP50:      {metrics.box.map50:.3f}  (accuracy at a loose box-overlap threshold)")
    print(f"mAP50-95:   {metrics.box.map:.3f}  (stricter score, averaged across overlap thresholds)")
    print(f"Precision:  {metrics.box.mp:.3f}  (of predicted boxes, fraction that were correct)")
    print(f"Recall:     {metrics.box.mr:.3f}  (of real vehicles in the images, fraction actually found)")
    print("\nThese are the numbers worth quoting on a resume/portfolio — computed")
    print("on images that had zero influence on training or model selection.")


if __name__ == "__main__":
    main()
