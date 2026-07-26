/** Portfolio-level roll-ups that feed the executive dashboard. */

import { RISK_THRESHOLDS } from "./riskScoring";
import type { RiskCategory, ScoredCustomer } from "./types";

export const CATEGORY_ORDER: RiskCategory[] = ["Green", "Amber", "Red"];

export const CATEGORY_COLOURS: Record<RiskCategory, string> = {
  Green: "#2f7d4f",
  Amber: "#b5720f",
  Red: "#b13030",
};

export const CATEGORY_BG: Record<RiskCategory, string> = {
  Green: "#eaf5ee",
  Amber: "#fdf3e2",
  Red: "#fbeaea",
};

export const CATEGORY_LABELS: Record<RiskCategory, string> = {
  Green: "Green (Low Risk)",
  Amber: "Amber (Medium Risk)",
  Red: "Red (High Risk)",
};

/** Neutral dark used for every exposure series — never a risk colour. */
export const EXPOSURE_COLOUR = "#333a42";

/** Blue to grey qualitative palette for the industry pie. */
export const INDUSTRY_PALETTE = [
  "#1f4267",
  "#2c5a8c",
  "#4a7ab0",
  "#7098c2",
  "#9db8d6",
  "#5b6572",
  "#8b95a1",
  "#b8c0c9",
];

export interface CategorySummary {
  category: RiskCategory;
  count: number;
  exposure: number;
  countShare: number;
  exposureShare: number;
}

export interface IndustrySummary {
  industry: string;
  exposure: number;
  count: number;
  share: number;
}

export function totalExposure(customers: ScoredCustomer[]): number {
  return customers.reduce((sum, c) => sum + c.loanBalance, 0);
}

export function averageRiskScore(customers: ScoredCustomer[]): number {
  if (customers.length === 0) return 0;
  const sum = customers.reduce((acc, c) => acc + c.riskScore, 0);
  return Math.round((sum / customers.length) * 10) / 10;
}

export function summariseByCategory(
  customers: ScoredCustomer[],
): CategorySummary[] {
  const total = totalExposure(customers);
  return CATEGORY_ORDER.map((category) => {
    const inCategory = customers.filter((c) => c.category === category);
    const exposure = totalExposure(inCategory);
    return {
      category,
      count: inCategory.length,
      exposure,
      countShare: customers.length ? (inCategory.length / customers.length) * 100 : 0,
      exposureShare: total ? (exposure / total) * 100 : 0,
    };
  });
}

export function summariseByIndustry(
  customers: ScoredCustomer[],
): IndustrySummary[] {
  const total = totalExposure(customers);
  const map = new Map<string, { exposure: number; count: number }>();
  customers.forEach((c) => {
    const key = c.industrySector || "Unclassified";
    const current = map.get(key) ?? { exposure: 0, count: 0 };
    current.exposure += c.loanBalance;
    current.count += 1;
    map.set(key, current);
  });
  return Array.from(map.entries())
    .map(([industry, v]) => ({
      industry,
      exposure: v.exposure,
      count: v.count,
      share: total ? (v.exposure / total) * 100 : 0,
    }))
    .sort((a, b) => b.exposure - a.exposure);
}

export function topRiskCustomers(
  customers: ScoredCustomer[],
  limit = 10,
): ScoredCustomer[] {
  return [...customers]
    .sort((a, b) => b.riskScore - a.riskScore || b.loanBalance - a.loanBalance)
    .slice(0, limit);
}

/**
 * Illustrative 12-point trend leading up to the portfolio's real current
 * average score. Generated from a seeded pseudo-random walk that tapers to the
 * true current value, so the chart is stable across re-renders and honest about
 * the fact that only the final point is measured. No history is available in a
 * single-snapshot upload — this is clearly labelled as illustrative in the UI.
 */
export function generatePortfolioTrend(
  customers: ScoredCustomer[],
  points = 12,
): { period: string; averageRiskScore: number }[] {
  const current = averageRiskScore(customers);
  if (customers.length === 0) return [];

  // Deterministic seed derived from the portfolio itself.
  let seed = customers.length * 7919 + Math.round(current * 100);
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const now = new Date();

  const series: { period: string; averageRiskScore: number }[] = [];
  let value = current - 4 + random() * 3;

  for (let i = points - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${monthNames[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;

    if (i === 0) {
      value = current;
    } else {
      const drift = (random() - 0.45) * 2.4;
      const pull = (current - value) * (1 - i / points) * 0.35;
      value = Math.max(0, Math.min(100, value + drift + pull));
    }

    series.push({
      period: label,
      averageRiskScore: Math.round(value * 10) / 10,
    });
  }

  return series;
}

/**
 * Recommended actions. Rules fire independently; if none apply the portfolio is
 * reported as within normal parameters — the list is never empty.
 */
export function recommendedActions(customers: ScoredCustomer[]): string[] {
  const actions: string[] = [];
  if (customers.length === 0) return actions;

  const total = totalExposure(customers);
  const summaries = summariseByCategory(customers);
  const red = summaries.find((s) => s.category === "Red")!;
  const amber = summaries.find((s) => s.category === "Amber")!;

  if (red.count > 0) {
    const names = topRiskCustomers(
      customers.filter((c) => c.category === "Red"),
      3,
    )
      .map((c) => c.customerName)
      .join(", ");
    actions.push(
      `Escalate the ${red.count} Red-rated customer${red.count === 1 ? "" : "s"} to credit committee for immediate review — starting with ${names}.`,
    );
  }

  if (red.exposureShare > 15) {
    actions.push(
      `Red-rated exposure is ${red.exposureShare.toFixed(1)}% of the portfolio (${formatCompactCurrency(red.exposure)}), above the 15% tolerance — consider provisioning review and restricting new limits.`,
    );
  }

  if (amber.count > 0) {
    actions.push(
      `Place the ${amber.count} Amber-rated customer${amber.count === 1 ? "" : "s"} on watchlist with a 30-day repayment check-in and refreshed credit bureau data.`,
    );
  }

  const industries = summariseByIndustry(customers);
  if (industries.length > 0 && industries[0].share > 30) {
    actions.push(
      `${industries[0].industry} accounts for ${industries[0].share.toFixed(1)}% of total exposure — concentration is above the 30% guidance; review sector appetite before further origination.`,
    );
  }

  const arrears = customers.filter((c) => c.repaymentRiskFactor >= 55);
  if (arrears.length > 0) {
    actions.push(
      `${arrears.length} customer${arrears.length === 1 ? " is" : "s are"} 30+ days in arrears — confirm collections contact has been made and hardship options assessed.`,
    );
  }

  if (actions.length === 0) {
    actions.push(
      `Portfolio is within normal parameters: no Red-rated customers, no Amber watchlist items, and no sector concentration above 30% of ${formatCompactCurrency(total)} total exposure. Continue standard quarterly monitoring.`,
    );
  }

  return actions;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function thresholdBands() {
  return [
    { label: "Green (Low Risk)", range: `0 – ${RISK_THRESHOLDS.greenMax}` },
    {
      label: "Amber (Medium Risk)",
      range: `${RISK_THRESHOLDS.greenMax + 1} – ${RISK_THRESHOLDS.amberMax}`,
    },
    { label: "Red (High Risk)", range: `${RISK_THRESHOLDS.amberMax + 1} – 100` },
  ];
}
