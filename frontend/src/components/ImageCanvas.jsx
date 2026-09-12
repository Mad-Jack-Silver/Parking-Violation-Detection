import React, { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Rect, Text, Circle } from "react-konva";

const ASPECT_RATIO = 3 / 2; // width:height
const MAX_WIDTH = 900;


export default function ImageCanvas({
  imageObj,
  zones,
  onZonesChange,
  detections = [],
  violatingDetectionIds = new Set(),
  legalDetectionIds = new Set(),
  activeZoneType = "restricted",
  drawingEnabled,
  onCanvasSize,
}) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: MAX_WIDTH, height: MAX_WIDTH / ASPECT_RATIO });
  const [inProgressPoints, setInProgressPoints] = useState([]);

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const width = Math.min(containerRef.current.clientWidth, MAX_WIDTH);
    const aspect =
      imageObj && imageObj.naturalWidth && imageObj.naturalHeight
        ? imageObj.naturalWidth / imageObj.naturalHeight
        : ASPECT_RATIO;
    const height = width / aspect;
    setSize({ width, height });
    onCanvasSize?.({ width, height });
  }, [imageObj, onCanvasSize]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useEffect(() => {
    setInProgressPoints([]);
  }, [imageObj]);

  function handleStageClick(e) {
    if (!drawingEnabled) return;
    const pos = e.target.getStage().getPointerPosition();
    setInProgressPoints((prev) => [...prev, pos.x, pos.y]);
  }

  function finishZone() {
    if (inProgressPoints.length < 6) return; // need at least 3 points
    const points = [];
    for (let i = 0; i < inProgressPoints.length; i += 2) {
      points.push({ x: inProgressPoints[i], y: inProgressPoints[i + 1] });
    }
    onZonesChange([...zones, { id: crypto.randomUUID(), label: activeZoneType, points }]);
    setInProgressPoints([]);
  }

  function undoLastPoint() {
    setInProgressPoints((prev) => prev.slice(0, -2));
  }

  const inProgressColor = activeZoneType === "parking_spot" ? "#10B981" : "#E8A33D";

  return (
    <div ref={containerRef} className="w-full">
      <div className="border border-borderc rounded-sm overflow-hidden bg-bg">
        <Stage width={size.width} height={size.height} onClick={handleStageClick}>
          <Layer>
            {imageObj && <KonvaImage image={imageObj} width={size.width} height={size.height} />}

            {/* Saved zones: Amber for restricted/no-parking, Emerald for designated parking spots */}
            {zones.map((zone) => {
              const isParkingSpot = zone.label === "parking_spot";
              const strokeColor = isParkingSpot ? "#10B981" : "#E8A33D";
              const fillColor = isParkingSpot ? "rgba(16, 185, 129, 0.18)" : "rgba(232, 163, 61, 0.18)";
              return (
                <Line
                  key={zone.id}
                  points={zone.points.flatMap((p) => [p.x, p.y])}
                  closed
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={2}
                />
              );
            })}

            {/* Zone currently being drawn */}
            {inProgressPoints.length > 0 && (
              <>
                <Line points={inProgressPoints} stroke={inProgressColor} strokeWidth={2} dash={[6, 4]} />
                {Array.from({ length: inProgressPoints.length / 2 }).map((_, i) => (
                  <Circle
                    key={i}
                    x={inProgressPoints[i * 2]}
                    y={inProgressPoints[i * 2 + 1]}
                    radius={4}
                    fill={inProgressColor}
                  />
                ))}
              </>
            )}

            {/* Detection boxes: Red = Violation, Green = Legal Parking, Cyan = Detected Vehicle */}
            {detections.map((det) => {
              const [x1, y1, x2, y2] = det.box;
              const isViolation = violatingDetectionIds.has(det.id);
              const isLegal = legalDetectionIds.has(det.id);

              let color = "#38BDF8"; // Cyan for unassigned/detected
              let tag = "";
              if (isViolation) {
                color = "#E4483E";
                tag = "  VIOLATION";
              } else if (isLegal) {
                color = "#10B981";
                tag = "  LEGAL PARKING";
              }

              return (
                <React.Fragment key={det.id}>
                  <Rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} stroke={color} strokeWidth={2.5} />
                  <Text
                    x={x1}
                    y={Math.max(y1 - 18, 0)}
                    text={`${det.class_name} ${(det.confidence * 100).toFixed(0)}%${tag}`}
                    fill={color}
                    fontSize={12}
                    fontFamily="IBM Plex Mono"
                  />
                </React.Fragment>
              );
            })}
          </Layer>
        </Stage>
      </div>

      {drawingEnabled && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={finishZone}
            disabled={inProgressPoints.length < 6}
            className="px-3 py-1.5 text-sm rounded-sm bg-amber text-bg font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber/90 transition-colors"
          >
            Finish {activeZoneType === "parking_spot" ? "parking spot" : "restricted zone"}{" "}
            <span className="font-mono">({inProgressPoints.length / 2})</span>
          </button>
          <button
            onClick={undoLastPoint}
            disabled={inProgressPoints.length === 0}
            className="px-3 py-1.5 text-sm rounded-sm border border-borderc text-muted disabled:opacity-30 disabled:cursor-not-allowed hover:text-text hover:border-text/40 transition-colors"
          >
            Undo point
          </button>
        </div>
      )}
    </div>
  );
}