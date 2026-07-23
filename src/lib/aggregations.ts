// Pure aggregation + formatting helpers that turn a scored customer list
// into everything the Executive Dashboard renders: KPI counts, chart data,
// the top-10 table, recommended actions, and a synthetic trend line.

import type { RiskCategory, ScoredCustomer, TrendPoint } from "./types";

export const RISK_CATEGORIES: RiskCategory[] = ["Green", "Amber", "Red"];

export const CATEGORY_COLORS: Record<RiskCategory, string> = {
  Green: "#2f7d4f",
  Amber: "#b5720f",
  Red: "#b13030",
};

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

export const EXPOSURE_SERIES_COLOR = "#333a42";

export function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyCompact(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export interface CategorySummary {
  category: RiskCategory;
  count: number;
  pctOfCustomers: number;
  exposure: number;
  pctOfExposure: number;
}

export function categorySummaries(customers: ScoredCustomer[]): CategorySummary[] {
  const total = customers.length;
  const totalExposure = customers.reduce((sum, c) => sum + c.loanBalance, 0);

  return RISK_CATEGORIES.map((category) => {
    const inCategory = customers.filter((c) => c.category === category);
    const exposure = inCategory.reduce((sum, c) => sum + c.loanBalance, 0);
    return {
      category,
      count: inCategory.length,
      pctOfCustomers: total === 0 ? 0 : (inCategory.length / total) * 100,
      exposure,
      pctOfExposure: totalExposure === 0 ? 0 : (exposure / totalExposure) * 100,
    };
  });
}

export function totalExposure(customers: ScoredCustomer[]): number {
  return customers.reduce((sum, c) => sum + c.loanBalance, 0);
}

export interface CategoryChartRow {
  category: RiskCategory;
  customers: number;
  exposure: number;
}

export function categoryChartData(customers: ScoredCustomer[]): CategoryChartRow[] {
  return categorySummaries(customers).map((s) => ({
    category: s.category,
    customers: s.count,
    exposure: s.exposure,
  }));
}

export interface IndustryExposureRow {
  industry: string;
  exposure: number;
}

export function exposureByIndustry(customers: ScoredCustomer[]): IndustryExposureRow[] {
  const map = new Map<string, number>();
  for (const c of customers) {
    map.set(c.industrySector, (map.get(c.industrySector) ?? 0) + c.loanBalance);
  }
  return Array.from(map.entries())
    .map(([industry, exposure]) => ({ industry, exposure }))
    .sort((a, b) => b.exposure - a.exposure);
}

export function topRiskCustomers(
  customers: ScoredCustomer[],
  n: number = 10
): ScoredCustomer[] {
  return [...customers].sort((a, b) => b.riskScore - a.riskScore).slice(0, n);
}

export function recommendedActions(customers: ScoredCustomer[]): string[] {
  const actions: string[] = [];
  const totalExp = totalExposure(customers);

  const redCustomers = customers.filter((c) => c.category === "Red");
  const amberCustomers = customers.filter((c) => c.category === "Amber");

  if (redCustomers.length > 0) {
    const names = redCustomers
      .slice(0, 5)
      .map((c) => c.customerName)
      .join(", ");
    const suffix = redCustomers.length > 5 ? `, and ${redCustomers.length - 5} more` : "";
    actions.push(
      `Escalate ${redCustomers.length} Red (high-risk) customer${redCustomers.length === 1 ? "" : "s"} for immediate review: ${names}${suffix}.`
    );
  }

  const redExposure = redCustomers.reduce((sum, c) => sum + c.loanBalance, 0);
  const redExposureShare = totalExp === 0 ? 0 : (redExposure / totalExp) * 100;
  if (redExposureShare > 15) {
    actions.push(
      `Red-category exposure is ${redExposureShare.toFixed(1)}% of total portfolio exposure, above the 15% concentration guide — consider portfolio-level mitigation.`
    );
  }

  if (amberCustomers.length > 0) {
    actions.push(
      `Place ${amberCustomers.length} Amber (medium-risk) customer${amberCustomers.length === 1 ? "" : "s"} on watchlist for closer monitoring.`
    );
  }

  const byIndustry = exposureByIndustry(customers);
  if (byIndustry.length > 0) {
    const top = byIndustry[0];
    const share = totalExp === 0 ? 0 : (top.exposure / totalExp) * 100;
    if (share > 30) {
      actions.push(
        `${top.industry} accounts for ${share.toFixed(1)}% of total exposure, above the 30% concentration guide — review industry concentration limits.`
      );
    }
  }

  if (actions.length === 0) {
    actions.push("Portfolio risk is within normal parameters — no escalations required at this time.");
  }

  return actions;
}

/**
 * A seeded pseudo-random walk that tapers into the real current portfolio
 * average risk score at the most recent point, purely to illustrate a
 * trend shape. This is not derived from any historical data (none exists
 * in this prototype) and is explicitly labelled "Illustrative" in the UI.
 */
export function generatePortfolioTrend(customers: ScoredCustomer[]): TrendPoint[] {
  const pointCount = 12;
  const currentAverage =
    customers.length === 0
      ? 0
      : customers.reduce((sum, c) => sum + c.riskScore, 0) / customers.length;

  // Simple seeded PRNG (mulberry32) so the walk is deterministic for a
  // given portfolio rather than jumping around on every render.
  let seed = Math.round(currentAverage * 1000) + customers.length + 1;
  function next(): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const points: TrendPoint[] = [];
  let value = Math.min(Math.max(currentAverage + (next() - 0.5) * 20, 0), 100);

  for (let i = 0; i < pointCount; i += 1) {
    const isLast = i === pointCount - 1;
    if (isLast) {
      value = currentAverage;
    } else {
      const drift = (next() - 0.5) * 8;
      // Taper the random walk toward the current average as we approach
      // the most recent point.
      const pull = ((i + 1) / pointCount) * (currentAverage - value) * 0.3;
      value = Math.min(Math.max(value + drift + pull, 0), 100);
    }
    const monthsAgo = pointCount - 1 - i;
    points.push({
      label: monthsAgo === 0 ? "Now" : `-${monthsAgo}m`,
      averageRiskScore: Math.round(value * 10) / 10,
    });
  }

  return points;
}
