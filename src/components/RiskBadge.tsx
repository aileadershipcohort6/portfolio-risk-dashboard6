import type { RiskCategory } from "@/lib/types";

const STYLES: Record<RiskCategory, { bg: string; fg: string; label: string }> = {
  Green: { bg: "var(--risk-green-bg)", fg: "var(--risk-green)", label: "Low Risk" },
  Amber: { bg: "var(--risk-amber-bg)", fg: "var(--risk-amber)", label: "Medium Risk" },
  Red: { bg: "var(--risk-red-bg)", fg: "var(--risk-red)", label: "High Risk" },
};

export default function RiskBadge({ category }: { category: RiskCategory }) {
  const style = STYLES[category];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
      style={{ background: style.bg, color: style.fg }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: style.fg }}
      />
      {category} &middot; {style.label}
    </span>
  );
}
