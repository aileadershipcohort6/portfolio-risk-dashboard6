"use client";

import { useRef } from "react";

interface UploadPanelProps {
  step: string;
  title: string;
  description: string;
  accept: string;
  fileName: string | null;
  required?: boolean;
  onSelect: (file: File | null) => void;
}

/**
 * A single upload card. The "Selected: <name>" line is driven by controlled
 * React state, not the native input's own label — native file inputs cannot be
 * set programmatically, so Load Sample Data would otherwise still read
 * "No file chosen". That mismatch is expected, not a bug.
 */
export default function UploadPanel({
  step,
  title,
  description,
  accept,
  fileName,
  required = false,
  onSelect,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">
          {step}. {title}
        </h2>
        <span
          className={
            required
              ? "shrink-0 rounded-md border border-[var(--accent)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--accent)]"
              : "shrink-0 rounded-md border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]"
          }
        >
          {required ? "Required" : "Optional"}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
        {description}
      </p>
      <div className="mt-4">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="block w-full text-sm"
          onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        />
      </div>
      {fileName && (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Selected: <span className="font-semibold">{fileName}</span>
        </p>
      )}
    </div>
  );
}
