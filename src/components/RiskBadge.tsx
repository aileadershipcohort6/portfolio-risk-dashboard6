import type { RiskCategory } from "@/lib/types";

const STYLES: Record<RiskCategory, { color: string; bg: string; label: string }> = {
  Green: { color: "var(--risk-green)", bg: "var(--risk-green-bg)", label: "Green (Low Risk)" },
  Amber: { color: "var(--risk-amber)", bg: "var(--risk-amber-bg)", label: "Amber (Medium Risk)" },
  Red: { color: "var(--risk-red)", bg: "var(--risk-red-bg)", label: "Red (High Risk)" },
};

export default function RiskBadge({ category, compact = false }: { category: RiskCategory; compact?: boolean }) {
  const style = STYLES[category];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium"
      style={{ color: style.color, background: style.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.color }} />
      {compact ? category : style.label}
    </span>
  );
}
