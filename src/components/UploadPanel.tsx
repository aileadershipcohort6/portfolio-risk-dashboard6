"use client";

interface UploadPanelProps {
  title: string;
  subtext: string;
  accept: string;
  required: boolean;
  selectedFileName: string | null;
  onFileSelected: (file: File | null) => void;
  inputId: string;
}

export default function UploadPanel({
  title,
  subtext,
  accept,
  required,
  selectedFileName,
  onFileSelected,
  inputId,
}: UploadPanelProps) {
  return (
    <div className="rounded-xl border bg-[var(--surface)] p-5 shadow-sm" style={{ borderColor: "var(--border)" }}>
      <h3 className="text-sm font-semibold">
        {title} {required ? null : <span className="font-normal" style={{ color: "var(--muted)" }}>(optional)</span>}
      </h3>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        {subtext}
      </p>
      <div className="mt-4">
        <input
          id={inputId}
          type="file"
          accept={accept}
          onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#171a1f] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:opacity-90"
        />
      </div>
      {selectedFileName && (
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Selected: <span className="font-semibold" style={{ color: "var(--foreground)" }}>{selectedFileName}</span>
        </p>
      )}
    </div>
  );
}
