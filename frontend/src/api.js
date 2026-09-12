const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

async function postJSON(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // includes data: prefix, backend strips it
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function detectVehicles(imageBase64, confThreshold = 0.20) {
  return postJSON("/detect", { image_base64: imageBase64, conf_threshold: confThreshold });
}

export function checkViolations(detections, zones) {
  return postJSON("/check-violations", { detections, zones });
}

export function generateReport(imageBase64, detections, violations) {
  return postJSON("/report", { image_base64: imageBase64, detections, violations });
}
