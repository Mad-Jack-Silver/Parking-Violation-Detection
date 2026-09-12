import os

API_KEY = os.environ.get("ROBOFLOW_API_KEY")
DEST_DIR = os.path.join(os.path.dirname(__file__), "..", "datasets")

if not API_KEY:
    raise SystemExit(
        "ROBOFLOW_API_KEY is not set. See the docstring at the top of this "
        "file for the free 2-minute setup steps."
    )

from roboflow import Roboflow

rf = Roboflow(api_key=API_KEY)

project = rf.workspace("popo-rinbd").project("parking-violations-lxf0d")
dataset = project.version(2).download("yolov8", location=DEST_DIR)

print(f"Downloaded to: {dataset.location}")
print("Next: python scripts/train.py")
