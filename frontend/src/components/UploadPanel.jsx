import React, { useState } from "react";

export default function UploadPanel({
  onFileSelected,
  onRunDetection,
  onRemoveImage,
  hasImage,
  isDetecting,
  confThreshold = 0.20,
  onConfThresholdChange,
}) {
  const [fileName, setFileName] = useState(null);

  function handleChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      onFileSelected(file);
    }
  }

  function handleRemove() {
    setFileName(null);
    onRemoveImage();
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="sr-only">Choose parking lot photo</span>
        <input
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="block w-full text-sm text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-sm file:border file:border-borderc file:bg-surface2 file:text-text file:text-sm hover:file:border-amber/60 file:cursor-pointer"
        />
      </label>
      {fileName && <p className="text-xs text-muted truncate">Selected: {fileName}</p>}

      <div className="pt-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted">Detection Confidence:</span>
          <span className="font-mono text-amber">{Math.round(confThreshold * 100)}%</span>
        </div>
        <input
          type="range"
          min="10"
          max="60"
          step="5"
          value={Math.round(confThreshold * 100)}
          onChange={(e) => onConfThresholdChange?.(Number(e.target.value) / 100)}
          className="w-full accent-amber cursor-pointer"
        />
        <p className="text-[11px] text-muted mt-1">
          20% is optimal for top-down parking lot cameras.
        </p>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onRunDetection}
          disabled={!hasImage || isDetecting}
          className="flex-1 px-3 py-2 text-sm rounded-sm bg-amber text-bg font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber/90 transition-colors"
        >
          {isDetecting ? "Detecting…" : "Run detection"}
        </button>
        {hasImage && (
          <button
            onClick={handleRemove}
            disabled={isDetecting}
            title="Remove the current photo and start over"
            className="px-3 py-2 text-sm rounded-sm border border-borderc text-muted disabled:opacity-30 disabled:cursor-not-allowed hover:text-text hover:border-text/40 transition-colors"
          >
            Remove photo
          </button>
        )}
      </div>
    </div>
  );
}