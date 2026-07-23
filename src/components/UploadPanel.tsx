"use client";

import { ChangeEvent, useRef } from "react";

interface UploadPanelProps {
  step: string;
  title: string;
  subtitle: string;
  accept: string;
  fileName: string | null;
  onFileSelected: (file: File) => void;
  optional?: boolean;
}

export default function UploadPanel({
  step,
  title,
  subtitle,
  accept,
  fileName,
  onFileSelected,
  optional,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm flex flex-col gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">
            {step}. {title}
          </h2>
          <span className="text-[10px] uppercase tracking-wide text-[var(--muted)] border border-[var(--border)] rounded-full px-2 py-0.5">
            {optional ? "Optional" : "Required"}
          </span>
        </div>
        <p className="text-sm text-[var(--muted)] mt-1">{subtitle}</p>
      </div>

      <div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-[#171a1f] file:text-white file:text-sm file:font-medium file:cursor-pointer cursor-pointer"
        />
      </div>

      {fileName && (
        <p className="text-sm text-[var(--muted)]">
          Selected: <span className="font-semibold text-[var(--foreground)]">{fileName}</span>
        </p>
      )}
    </div>
  );
}
