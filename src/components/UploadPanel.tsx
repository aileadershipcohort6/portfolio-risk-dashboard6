"use client";

import { useRef } from "react";

interface UploadPanelProps {
  step: string;
  title: string;
  description: string;
  accept: string;
  fileName: string | null;
  onFileSelected: (file: File | null) => void;
}

export default function UploadPanel({
  step,
  title,
  description,
  accept,
  fileName,
  onFileSelected,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h2 className="text-sm font-semibold">
        {step}. {title}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
        {description}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
        className="mt-4 block w-full text-xs text-[var(--muted)] file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#171a1f] file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-[#2a2f37]"
      />

      {/* Controlled selection state — the native input's own label does not
          update when Load Sample Data populates the file programmatically. */}
      {fileName && (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Selected: <span className="font-semibold">{fileName}</span>
        </p>
      )}
    </div>
  );
}
