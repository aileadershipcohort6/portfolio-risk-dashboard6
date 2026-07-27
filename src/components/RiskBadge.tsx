import type { RiskCategory } from "@/lib/types";

const STYLES: Record<RiskCategory, { bg: string; fg: string; label: string }> = {
  Green: {
    bg: "var(--risk-green-bg)",
    fg: "var(--risk-green)",
    label: "Green",
  },
  Amber: {
    bg: "var(--risk-amber-bg)",
    fg: "var(--risk-amber)",
    label: "Amber",
  },
  Red: { bg: "var(--risk-red-bg)", fg: "var(--risk-red)", label: "Red" },
};

export default function RiskBadge({ category }: { category: RiskCategory }) {
  const style = STYLES[category];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: style.fg }}
        aria-hidden="true"
      />
      {style.label}
    </span>
  );
}
