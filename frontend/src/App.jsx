import React, { useState } from "react";
import ImageCanvas from "./components/ImageCanvas.jsx";
import UploadPanel from "./components/UploadPanel.jsx";
import ViolationReport from "./components/ViolationReport.jsx";
import { fileToBase64, detectVehicles, checkViolations, generateReport } from "./api.js";

export default function App() {
  const [imageBase64, setImageBase64] = useState(null);
  const [imageObj, setImageObj] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 600 });
  const [zones, setZones] = useState([]);
  const [activeZoneType, setActiveZoneType] = useState("restricted"); // "restricted" | "parking_spot"
  const [confThreshold, setConfThreshold] = useState(0.20);
  const [detections, setDetections] = useState([]);
  const [violations, setViolations] = useState([]);
  const [legalParkings, setLegalParkings] = useState([]);
  const [invalidZoneIds, setInvalidZoneIds] = useState([]);
  const [plates, setPlates] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [drawingEnabled, setDrawingEnabled] = useState(true);
  const [error, setError] = useState(null);

  async function handleFileSelected(file) {
    const base64 = await fileToBase64(file);
    setImageBase64(base64);
    setDetections([]);
    setViolations([]);
    setLegalParkings([]);
    setInvalidZoneIds([]);
    setPlates([]);
    setZones([]);
    setError(null);

    const img = new window.Image();
    img.src = base64;
    img.onload = () => setImageObj(img);
  }

  async function handleRunDetection() {
    setError(null);
    setIsDetecting(true);
    try {
      const detectResult = await detectVehicles(imageBase64, confThreshold);
      // Scale YOLO's original-image-pixel boxes down to the canvas's
      // actual rendered size, whatever that happens to be right now.
      const scaleX = canvasSize.width / detectResult.image_width;
      const scaleY = canvasSize.height / detectResult.image_height;
      const scaledDetections = detectResult.detections.map((d) => ({
        ...d,
        box: [d.box[0] * scaleX, d.box[1] * scaleY, d.box[2] * scaleX, d.box[3] * scaleY],
      }));
      setDetections(scaledDetections);

      if (zones.length > 0) {
        const checkResult = await checkViolations(scaledDetections, zones);
        setViolations(checkResult.violations || []);
        setLegalParkings(checkResult.legal_parkings || []);
        setInvalidZoneIds(checkResult.invalid_zone_ids || []);
      } else {
        setViolations([]);
        setLegalParkings([]);
        setInvalidZoneIds([]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsDetecting(false);
    }
  }

  async function handleRecheckViolations() {
    setError(null);
    try {
      const checkResult = await checkViolations(detections, zones);
      setViolations(checkResult.violations || []);
      setLegalParkings(checkResult.legal_parkings || []);
      setInvalidZoneIds(checkResult.invalid_zone_ids || []);
    } catch (e) {
      setError(e.message);
    }
  }

  function handleClearZones() {
    setZones([]);
    setDetections([]);
    setViolations([]);
    setLegalParkings([]);
    setInvalidZoneIds([]);
    setPlates([]);
    setError(null);
  }

  function handleRemoveImage() {
    setImageBase64(null);
    setImageObj(null);
    setZones([]);
    setDetections([]);
    setViolations([]);
    setLegalParkings([]);
    setInvalidZoneIds([]);
    setPlates([]);
    setError(null);
  }

  async function handleGenerateReport() {
    setError(null);
    try {
      const result = await generateReport(imageBase64, detections, violations);
      setPlates(result.plates);
    } catch (e) {
      setError(e.message);
    }
  }

  const violatingIds = new Set(violations.map((v) => v.detection_id));
  const legalIds = new Set(legalParkings.map((p) => p.detection_id));

  return (
    <div className="min-h-screen bg-bg text-text font-display">
      <header className="border-b border-borderc px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${isDetecting ? "bg-amber animate-pulse" : "bg-clear"}`}
            aria-hidden="true"
          />
          <h1 className="text-lg font-semibold tracking-tight">Parking Violation & Compliance Detection</h1>
        </div>
        <div className="font-mono text-xs text-muted flex gap-5">
          <span>
            vehicles <span className="text-text font-bold">{detections.length}</span>
          </span>
          <span className="rounded-sm px-1">
            violations <span className="text-violation font-bold">{violations.length}</span>
          </span>
          {legalParkings.length > 0 && (
            <span className="rounded-sm px-1">
              legal <span className="text-emerald-400 font-bold">{legalParkings.length}</span>
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-violation/10 border border-violation/30 text-violation text-sm rounded-sm">
          {error}
        </div>
      )}

      <main className="flex flex-col lg:flex-row gap-6 p-6 max-w-6xl mx-auto">
        <section className="flex-1 min-w-0">
          <div className="bg-surface border border-borderc rounded-sm p-4">
            <p className="text-sm text-muted mb-4 max-w-[70ch]">
              Upload a parking lot photo. Mark <strong>Restricted Zones</strong> (no-parking areas) or <strong>Parking Spots</strong> (designated bays). Run detection to flag violations or verify legal parking.
            </p>
            {imageObj ? (
              <ImageCanvas
                imageObj={imageObj}
                zones={zones}
                onZonesChange={setZones}
                detections={detections}
                violatingDetectionIds={violatingIds}
                legalDetectionIds={legalIds}
                activeZoneType={activeZoneType}
                drawingEnabled={drawingEnabled}
                onCanvasSize={setCanvasSize}
              />
            ) : (
              <div className="aspect-[3/2] flex items-center justify-center text-sm text-muted border border-dashed border-borderc rounded-sm">
                No image loaded yet
              </div>
            )}
          </div>
        </section>

        <aside className="w-full lg:w-80 flex-shrink-0 space-y-4">
          <div className="bg-surface border border-borderc rounded-sm p-4">
            <h2 className="text-sm font-semibold mb-3">Upload & Settings</h2>
            <UploadPanel
              onFileSelected={handleFileSelected}
              onRunDetection={handleRunDetection}
              onRemoveImage={handleRemoveImage}
              hasImage={!!imageBase64}
              isDetecting={isDetecting}
              confThreshold={confThreshold}
              onConfThresholdChange={setConfThreshold}
            />
          </div>

          <div className="bg-surface border border-borderc rounded-sm p-4">
            <h2 className="text-sm font-semibold mb-2">Zone Type & Drawing</h2>
            
            <div className="mb-3 space-y-1.5">
              <span className="text-xs text-muted block">Active Zone Mode:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveZoneType("restricted")}
                  className={`px-2 py-1.5 text-xs rounded-sm border transition-colors ${
                    activeZoneType === "restricted"
                      ? "border-amber bg-amber/15 text-amber font-semibold"
                      : "border-borderc text-muted hover:text-text"
                  }`}
                >
                  🚫 Restricted Area
                </button>
                <button
                  type="button"
                  onClick={() => setActiveZoneType("parking_spot")}
                  className={`px-2 py-1.5 text-xs rounded-sm border transition-colors ${
                    activeZoneType === "parking_spot"
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-400 font-semibold"
                      : "border-borderc text-muted hover:text-text"
                  }`}
                >
                  🅿️ Parking Bay
                </button>
              </div>
              <p className="text-[11px] text-muted pt-0.5">
                {activeZoneType === "restricted"
                  ? "Vehicles inside are flagged as violations (Red)."
                  : "Vehicles inside are verified as legal (Green); straddlers are flagged."}
              </p>
            </div>

            <label className="flex items-start gap-2 text-sm text-muted cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={drawingEnabled}
                onChange={(e) => setDrawingEnabled(e.target.checked)}
                className="mt-0.5 accent-amber"
              />
              Click points on image, then "Finish zone"
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleRecheckViolations}
                disabled={detections.length === 0 || zones.length === 0}
                title="Re-checks violations against the current zones using the detections already on screen"
                className="px-2.5 py-1.5 text-xs rounded-sm bg-amber text-bg font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber/90 transition-colors"
              >
                Recheck violations
              </button>
              <button
                onClick={handleClearZones}
                disabled={zones.length === 0 && detections.length === 0}
                title="Clears zones, detections and violations but keeps current photo"
                className="px-2.5 py-1.5 text-xs rounded-sm border border-borderc text-muted disabled:opacity-30 disabled:cursor-not-allowed hover:text-text hover:border-text/40 transition-colors"
              >
                Clear zones
              </button>
            </div>
          </div>

          <div className="bg-surface border border-borderc rounded-sm p-4">
            <ViolationReport
              violations={violations}
              legalParkings={legalParkings}
              invalidZoneIds={invalidZoneIds}
              plates={plates}
              onGenerateReport={handleGenerateReport}
              canGenerate={violations.length > 0}
            />
          </div>
        </aside>
      </main>
    </div>
  );
}