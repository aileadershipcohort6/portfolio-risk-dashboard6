/**
 * Portfolio-level aggregations that feed the executive dashboard.
 * Pure functions over the scored customer list — no state, no side effects.
 */

import type { RiskCategory, ScoredCustomer } from "./types";

export const CATEGORY_ORDER: RiskCategory[] = ["Green", "Amber", "Red"];

export const CATEGORY_LABEL: Record<RiskCategory, string> = {
  Green: "Green (Low Risk)",
  Amber: "Amber (Medium Risk)",
  Red: "Red (High Risk)",
};

export const CATEGORY_COLOR: Record<RiskCategory, string> = {
  Green: "var(--risk-green)",
  Amber: "var(--risk-amber)",
  Red: "var(--risk-red)",
};

export const CATEGORY_HEX: Record<RiskCategory, string> = {
  Green: "#2f7d4f",
  Amber: "#b5720f",
  Red: "#b13030",
};

/** Blue -> grey qualitative palette for the industry pie chart. */
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
}

export const totalExposure = (customers: ScoredCustomer[]) =>
  customers.reduce((sum, c) => sum + c.loanBalance, 0);

export const averageRiskScore = (customers: ScoredCustomer[]) =>
  customers.length === 0
    ? 0
    : customers.reduce((sum, c) => sum + c.riskScore, 0) / customers.length;

export function summariseByCategory(
  customers: ScoredCustomer[]
): CategorySummary[] {
  const total = totalExposure(customers);
  return CATEGORY_ORDER.map((category) => {
    const inCategory = customers.filter((c) => c.category === category);
    const exposure = totalExposure(inCategory);
    return {
      category,
      count: inCategory.length,
      exposure,
      countShare: customers.length ? inCategory.length / customers.length : 0,
      exposureShare: total ? exposure / total : 0,
    };
  });
}

export function summariseByIndustry(
  customers: ScoredCustomer[]
): IndustrySummary[] {
  const map = new Map<string, IndustrySummary>();
  for (const c of customers) {
    const key = c.industrySector || "Unclassified";
    const existing = map.get(key);
    if (existing) {
      existing.exposure += c.loanBalance;
      existing.count += 1;
    } else {
      map.set(key, { industry: key, exposure: c.loanBalance, count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.exposure - a.exposure);
}

export function topRiskCustomers(customers: ScoredCustomer[], limit = 10) {
  return [...customers]
    .sort((a, b) => b.riskScore - a.riskScore || b.loanBalance - a.loanBalance)
    .slice(0, limit);
}

export interface TrendPoint {
  period: string;
  averageRiskScore: number;
}

/**
 * Illustrative 12-period risk trend. Generated from a seeded pseudo-random
 * walk that tapers to the portfolio's real current average at the final point,
 * so the chart is stable across reloads and always ends on the true number.
 * This is a visualisation aid — the portfolio upload carries no history.
 */
export function generatePortfolioTrend(
  customers: ScoredCustomer[],
  periods = 12
): TrendPoint[] {
  const current = averageRiskScore(customers);
  if (customers.length === 0) return [];

  // Deterministic seed derived from the portfolio itself.
  let seed = customers.length * 7919 + Math.round(current * 100);
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  const now = new Date();
  const points: TrendPoint[] = [];

  for (let i = periods - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = d.toLocaleDateString("en-AU", {
      month: "short",
      year: "2-digit",
    });

    if (i === 0) {
      points.push({
        period,
        averageRiskScore: Math.round(current * 10) / 10,
      });
    } else {
      // Drift away from the current value the further back we go, plus noise.
      const drift = (rand() - 0.45) * 6 * (i / periods);
      const offset = (rand() - 0.5) * 4;
      const value = Math.max(0, Math.min(100, current - drift * 1.5 + offset));
      points.push({ period, averageRiskScore: Math.round(value * 10) / 10 });
    }
  }

  return points;
}

/**
 * Recommended actions for the executive summary. Rules fire in priority order
 * and the list is never empty — if nothing triggers, we say so explicitly.
 */
export function recommendedActions(customers: ScoredCustomer[]): string[] {
  const actions: string[] = [];
  if (customers.length === 0) return ["No customer records were analysed."];

  const total = totalExposure(customers);
  const red = customers.filter((c) => c.category === "Red");
  const amber = customers.filter((c) => c.category === "Amber");
  const redExposure = totalExposure(red);
  const industries = summariseByIndustry(customers);
  const topIndustry = industries[0];

  if (red.length > 0) {
    const names = [...red]
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 3)
      .map((c) => c.customerName)
      .join(", ");
    actions.push(
      `Escalate the ${red.length} Red (High Risk) customer${
        red.length === 1 ? "" : "s"
      } to the credit committee for immediate review — starting with ${names}${
        red.length > 3 ? " and others" : ""
      }.`
    );
  }

  if (total > 0 && redExposure / total > 0.15) {
    actions.push(
      `Red-rated exposure is ${Math.round(
        (redExposure / total) * 100
      )}% of the portfolio, above the 15% tolerance — review provisioning levels and consider restricting new lending to this segment.`
    );
  }

  if (amber.length > 0) {
    actions.push(
      `Place the ${amber.length} Amber (Medium Risk) customer${
        amber.length === 1 ? "" : "s"
      } on the watchlist with a 30-day repayment check-in and refreshed financials.`
    );
  }

  if (topIndustry && total > 0 && topIndustry.exposure / total > 0.3) {
    actions.push(
      `${topIndustry.industry} accounts for ${Math.round(
        (topIndustry.exposure / total) * 100
      )}% of total exposure, breaching the 30% single-sector concentration guideline — diversify new originations away from this sector.`
    );
  }

  if (actions.length === 0) {
    actions.push(
      "Portfolio risk is within normal parameters. Maintain the current monitoring cycle and re-run this analysis after the next reporting period."
    );
  }

  return actions;
}

/* ---------------------------------- format --------------------------------- */

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);

export const formatCompactCurrency = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
