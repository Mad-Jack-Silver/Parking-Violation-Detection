import React from "react";

export default function ViolationReport({
  violations = [],
  legalParkings = [],
  invalidZoneIds = [],
  plates,
  onGenerateReport,
  canGenerate,
}) {
  const plateByDetection = Object.fromEntries((plates || []).map((p) => [p.detection_id, p]));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">
            Violations <span className="font-mono text-violation">{violations.length}</span>
          </h2>
          {legalParkings.length > 0 && (
            <span className="text-xs font-mono text-emerald-400">
              Legal: {legalParkings.length}
            </span>
          )}
        </div>
        <button
          onClick={onGenerateReport}
          disabled={!canGenerate || violations.length === 0}
          className="px-2.5 py-1 text-xs rounded-sm border border-borderc text-muted disabled:opacity-30 disabled:cursor-not-allowed hover:text-text hover:border-text/40 transition-colors"
        >
          Generate report
        </button>
      </div>

      {invalidZoneIds.length > 0 && (
        <p className="text-xs text-amber border border-amber/30 bg-amber/10 rounded-sm px-3 py-2 mb-3">
          {invalidZoneIds.length === 1 ? "One zone shape is" : `${invalidZoneIds.length} zone shapes are`}{" "}
          invalid (the points self-intersect into a "bowtie") and can never register a violation. Delete
          it and redraw, clicking points in order around the perimeter — not crosswise.
        </p>
      )}

      {violations.length === 0 ? (
        <p className="text-sm text-muted">
          {legalParkings.length > 0
            ? `${legalParkings.length} vehicle(s) verified parked correctly.`
            : "No violations yet — mark a zone and run detection."}
        </p>
      ) : (
        <ul className="space-y-2">
          {violations.map((v, i) => {
            const plate = plateByDetection[v.detection_id];
            const isImproper = v.violation_type === "improper_parking";
            return (
              <li
                key={v.detection_id}
                title={`detection id: ${v.detection_id}`}
                className="text-sm border border-borderc rounded-sm px-3 py-2 bg-surface2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text">Vehicle {i + 1}</span>
                  <span className="font-mono text-xs">
                    {plate?.plate_text ? (
                      <span className="text-text">{plate.plate_text}</span>
                    ) : (
                      <span className="text-muted" title="No plate-shaped text found in this crop">
                        no plate read
                      </span>
                    )}
                  </span>
                </div>
                <div className="text-[11px] text-violation mt-0.5">
                  {v.description || (isImproper ? "Improper parking (line straddle)" : "Parked in restricted zone")}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}