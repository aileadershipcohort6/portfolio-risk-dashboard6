import { CATEGORY_BG, CATEGORY_COLOURS } from "@/lib/aggregations";
import type { RiskCategory } from "@/lib/types";

export default function RiskBadge({ category }: { category: RiskCategory }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{
        backgroundColor: CATEGORY_BG[category],
        color: CATEGORY_COLOURS[category],
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: CATEGORY_COLOURS[category] }}
      />
      {category}
    </span>
  );
}
