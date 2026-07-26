import type { RiskCategory, ScoredCustomer } from "./types";

export interface CategorySummary {
  category: RiskCategory;
  count: number;
  exposure: number;
  pctOfCustomers: number;
  pctOfExposure: number;
}

const CATEGORY_ORDER: RiskCategory[] = ["Green", "Amber", "Red"];

export function totalExposure(customers: ScoredCustomer[]): number {
  return customers.reduce((sum, c) => sum + c.loanBalance, 0);
}

export function categorySummaries(customers: ScoredCustomer[]): CategorySummary[] {
  const total = customers.length;
  const totalExp = totalExposure(customers);

  return CATEGORY_ORDER.map((category) => {
    const inCategory = customers.filter((c) => c.category === category);
    const exposure = inCategory.reduce((sum, c) => sum + c.loanBalance, 0);
    return {
      category,
      count: inCategory.length,
      exposure,
      pctOfCustomers: total > 0 ? (inCategory.length / total) * 100 : 0,
      pctOfExposure: totalExp > 0 ? (exposure / totalExp) * 100 : 0,
    };
  });
}

export interface IndustryExposure {
  industry: string;
  exposure: number;
  count: number;
}

export function exposureByIndustry(customers: ScoredCustomer[]): IndustryExposure[] {
  const map = new Map<string, IndustryExposure>();
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

export function topRiskCustomers(customers: ScoredCustomer[], n = 10): ScoredCustomer[] {
  return [...customers].sort((a, b) => b.riskScore - a.riskScore).slice(0, n);
}

export interface TrendPoint {
  label: string;
  averageRiskScore: number;
}

/**
 * Generates an illustrative portfolio risk trend leading up to the current
 * position: a seeded pseudo-random walk that tapers to the real current
 * average at the most recent point.
 */
export function generatePortfolioTrend(customers: ScoredCustomer[], points = 8): TrendPoint[] {
  const currentAverage =
    customers.length > 0
      ? customers.reduce((sum, c) => sum + c.riskScore, 0) / customers.length
      : 0;

  // Simple deterministic seeded PRNG (mulberry32) so the trend is stable
  // across renders for the same portfolio.
  let seed = Math.round(currentAverage * 1000) + customers.length;
  function nextRandom() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const trend: TrendPoint[] = [];
  let value = Math.max(0, Math.min(100, currentAverage + (nextRandom() - 0.5) * 20));

  for (let i = 0; i < points - 1; i += 1) {
    const weeksAgo = points - 1 - i;
    trend.push({ label: `Week -${weeksAgo}`, averageRiskScore: Number(value.toFixed(1)) });
    const drift = (nextRandom() - 0.5) * 10;
    const pullToCurrent = (currentAverage - value) * 0.15;
    value = Math.max(0, Math.min(100, value + drift + pullToCurrent));
  }

  trend.push({ label: "Current", averageRiskScore: Number(currentAverage.toFixed(1)) });

  return trend;
}

export function recommendedActions(customers: ScoredCustomer[]): string[] {
  const actions: string[] = [];

  const redCustomers = customers.filter((c) => c.category === "Red");
  if (redCustomers.length > 0) {
    const names = redCustomers
      .slice(0, 5)
      .map((c) => c.customerName)
      .join(", ");
    const suffix = redCustomers.length > 5 ? ` and ${redCustomers.length - 5} more` : "";
    actions.push(`Escalate ${redCustomers.length} high-risk (Red) customer(s) for review: ${names}${suffix}.`);
  }

  const totalExp = totalExposure(customers);
  const redExposure = redCustomers.reduce((sum, c) => sum + c.loanBalance, 0);
  if (totalExp > 0 && redExposure / totalExp > 0.15) {
    actions.push(
      `Red-category exposure is ${((redExposure / totalExp) * 100).toFixed(1)}% of total portfolio exposure, above the 15% concentration flag — review capital and provisioning impact.`
    );
  }

  const amberCustomers = customers.filter((c) => c.category === "Amber");
  if (amberCustomers.length > 0) {
    actions.push(`Place ${amberCustomers.length} medium-risk (Amber) customer(s) on the watchlist for closer monitoring.`);
  }

  const industries = exposureByIndustry(customers);
  if (industries.length > 0 && totalExp > 0) {
    const top = industries[0];
    const share = (top.exposure / totalExp) * 100;
    if (share > 30) {
      actions.push(
        `${top.industry} accounts for ${share.toFixed(1)}% of total exposure, above the 30% concentration flag — consider diversification limits.`
      );
    }
  }

  if (actions.length === 0) {
    actions.push("Portfolio risk profile is within normal parameters — no immediate action required.");
  }

  return actions;
}
