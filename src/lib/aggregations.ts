/**
 * Portfolio-level aggregations that feed the executive dashboard.
 * Pure functions over the scored customer list — no state, no side effects.
 */

import type { RiskCategory, RiskWeights, ScoredCustomer } from "./types";

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
 * Fixed month abbreviations rather than toLocaleDateString: CLDR's en-AU
 * abbreviated forms are inconsistent (July renders as "July", September as
 * "Sept"), which makes the trend axis look ragged.
 */
const MONTH_ABBR = [
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

const periodLabel = (monthsAgo: number) => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  return `${MONTH_ABBR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
};

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

  const points: TrendPoint[] = [];

  for (let i = periods - 1; i >= 0; i -= 1) {
    const period = periodLabel(i);

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

/* --------------------------- risk driver analysis -------------------------- */

/**
 * Risk driver analysis answers "what is triggering at-risk behaviour?".
 *
 * Every customer's score is the weighted sum of three factors, so each factor's
 * weighted contribution is directly comparable — the largest contribution is
 * the driver actually pushing that customer up the scale. Aggregating those
 * contributions shows which driver is escalating the portfolio as a whole.
 */

export type DriverKey = "credit" | "repayment" | "exposure";

export const DRIVER_LABEL: Record<DriverKey, string> = {
  credit: "Credit quality",
  repayment: "Repayment behaviour",
  exposure: "Exposure size",
};

/** Distinct from the risk ramp — these encode driver identity, not severity. */
export const DRIVER_HEX: Record<DriverKey, string> = {
  credit: "#1f4267",
  repayment: "#4a7ab0",
  exposure: "#8b95a1",
};

/** Weighted contribution of each factor to one customer's score. */
export function driverContributions(
  customer: ScoredCustomer,
  weights: RiskWeights
): Record<DriverKey, number> {
  return {
    credit: weights.creditRiskWeight * customer.creditScoreFactor,
    repayment: weights.repaymentRiskWeight * customer.repaymentRiskFactor,
    exposure: weights.exposureWeight * customer.exposureFactor,
  };
}

/** The single factor contributing most to a customer's score. */
export function primaryDriver(
  customer: ScoredCustomer,
  weights: RiskWeights
): DriverKey {
  const c = driverContributions(customer, weights);
  return (Object.keys(c) as DriverKey[]).reduce((best, key) =>
    c[key] > c[best] ? key : best
  );
}

export interface DriverContributionRow {
  category: RiskCategory;
  credit: number;
  repayment: number;
  exposure: number;
}

/**
 * Average weighted contribution of each driver, split by risk category.
 * Stacked, the three values sum to that category's average risk score — so the
 * chart reads as "here is what the Red score is actually made of".
 */
export function contributionByCategory(
  customers: ScoredCustomer[],
  weights: RiskWeights
): DriverContributionRow[] {
  return CATEGORY_ORDER.map((category) => {
    const inCategory = customers.filter((c) => c.category === category);
    const n = inCategory.length || 1;
    const sum = inCategory.reduce(
      (acc, c) => {
        const d = driverContributions(c, weights);
        acc.credit += d.credit;
        acc.repayment += d.repayment;
        acc.exposure += d.exposure;
        return acc;
      },
      { credit: 0, repayment: 0, exposure: 0 }
    );
    return {
      category,
      credit: Math.round((sum.credit / n) * 10) / 10,
      repayment: Math.round((sum.repayment / n) * 10) / 10,
      exposure: Math.round((sum.exposure / n) * 10) / 10,
    };
  });
}

export interface PrimaryDriverRow {
  driver: DriverKey;
  count: number;
  exposure: number;
  share: number;
}

/** How many customers each driver is the dominant trigger for. */
export function primaryDriverBreakdown(
  customers: ScoredCustomer[],
  weights: RiskWeights,
  categories?: RiskCategory[]
): PrimaryDriverRow[] {
  const scope = categories
    ? customers.filter((c) => categories.includes(c.category))
    : customers;

  const rows: Record<DriverKey, { count: number; exposure: number }> = {
    credit: { count: 0, exposure: 0 },
    repayment: { count: 0, exposure: 0 },
    exposure: { count: 0, exposure: 0 },
  };

  for (const c of scope) {
    const key = primaryDriver(c, weights);
    rows[key].count += 1;
    rows[key].exposure += c.loanBalance;
  }

  return (Object.keys(rows) as DriverKey[])
    .map((driver) => ({
      driver,
      count: rows[driver].count,
      exposure: rows[driver].exposure,
      share: scope.length ? rows[driver].count / scope.length : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export interface SectorRiskRow {
  industry: string;
  averageRiskScore: number;
  count: number;
  exposure: number;
  atRiskShare: number;
}

/** Average risk score by sector — surfaces where at-risk behaviour clusters. */
export function sectorRiskProfile(
  customers: ScoredCustomer[],
  limit = 8
): SectorRiskRow[] {
  const map = new Map<string, ScoredCustomer[]>();
  for (const c of customers) {
    const key = c.industrySector || "Unclassified";
    map.set(key, [...(map.get(key) ?? []), c]);
  }

  return Array.from(map.entries())
    .map(([industry, list]) => ({
      industry,
      averageRiskScore: Math.round(averageRiskScore(list) * 10) / 10,
      count: list.length,
      exposure: totalExposure(list),
      atRiskShare:
        list.filter((c) => c.category !== "Green").length / list.length,
    }))
    .sort((a, b) => b.averageRiskScore - a.averageRiskScore)
    .slice(0, limit);
}

export interface DriverTrendPoint {
  period: string;
  credit: number;
  repayment: number;
  exposure: number;
}

/**
 * Illustrative 12-period trend for each driver, ending on the portfolio's real
 * current contributions. Exposure is held near-flat because loan balances move
 * slowly, while credit and repayment carry the volatility — so the chart shows
 * which driver is escalating rather than implying all three move together.
 */
export function generateDriverTrend(
  customers: ScoredCustomer[],
  weights: RiskWeights,
  periods = 12
): DriverTrendPoint[] {
  if (customers.length === 0) return [];

  const n = customers.length;
  const totals = customers.reduce(
    (acc, c) => {
      const d = driverContributions(c, weights);
      acc.credit += d.credit;
      acc.repayment += d.repayment;
      acc.exposure += d.exposure;
      return acc;
    },
    { credit: 0, repayment: 0, exposure: 0 }
  );
  const current = {
    credit: totals.credit / n,
    repayment: totals.repayment / n,
    exposure: totals.exposure / n,
  };

  let seed = n * 6421 + Math.round((current.credit + current.repayment) * 100);
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  const points: DriverTrendPoint[] = [];
  const round1 = (v: number) => Math.round(v * 10) / 10;

  for (let i = periods - 1; i >= 0; i -= 1) {
    const period = periodLabel(i);

    if (i === 0) {
      points.push({
        period,
        credit: round1(current.credit),
        repayment: round1(current.repayment),
        exposure: round1(current.exposure),
      });
      continue;
    }

    const decay = i / periods;
    const shape = (base: number, volatility: number) =>
      round1(
        Math.max(
          0,
          base - base * 0.28 * decay * volatility + (rand() - 0.5) * volatility
        )
      );

    points.push({
      period,
      credit: shape(current.credit, 1.6),
      repayment: shape(current.repayment, 2.4),
      exposure: shape(current.exposure, 0.5),
    });
  }

  return points;
}

/**
 * Plain-language findings about what is triggering at-risk behaviour.
 * Always returns at least one line.
 */
export function riskDriverInsights(
  customers: ScoredCustomer[],
  weights: RiskWeights
): string[] {
  if (customers.length === 0) return ["No customer records were analysed."];

  const insights: string[] = [];
  const atRisk = customers.filter((c) => c.category !== "Green");
  const trend = generateDriverTrend(customers, weights);

  // 1. Dominant trigger among at-risk customers.
  if (atRisk.length > 0) {
    const breakdown = primaryDriverBreakdown(customers, weights, [
      "Amber",
      "Red",
    ]);
    const top = breakdown[0];
    if (top && top.count > 0) {
      insights.push(
        `${DRIVER_LABEL[top.driver]} is the dominant trigger for ${
          top.count
        } of the ${atRisk.length} Amber and Red customers (${Math.round(
          top.share * 100
        )}%), carrying ${formatCompactCurrency(top.exposure)} of exposure.`
      );
    }
  }

  // 2. Which driver has moved most over the trend window.
  if (trend.length > 1) {
    const first = trend[0];
    const last = trend[trend.length - 1];
    const deltas = (
      [
        { key: "credit", delta: last.credit - first.credit },
        { key: "repayment", delta: last.repayment - first.repayment },
        { key: "exposure", delta: last.exposure - first.exposure },
      ] as { key: DriverKey; delta: number }[]
    ).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const moved = deltas[0];
    if (Math.abs(moved.delta) >= 0.5) {
      insights.push(
        `${DRIVER_LABEL[moved.key]} has ${
          moved.delta > 0 ? "risen" : "eased"
        } by ${Math.abs(moved.delta).toFixed(
          1
        )} points over the trend window — the largest movement of the three drivers.`
      );
    }
  }

  // 3. Arrears concentration.
  const inArrears = customers.filter((c) => c.repaymentRiskFactor >= 55);
  if (inArrears.length > 0) {
    insights.push(
      `${inArrears.length} customer${
        inArrears.length === 1 ? " is" : "s are"
      } 30 days or more in arrears, representing ${formatCompactCurrency(
        totalExposure(inArrears)
      )} of exposure — the clearest early warning in the portfolio.`
    );
  }

  // 4. Sector where at-risk behaviour clusters.
  const sectors = sectorRiskProfile(customers).filter((s) => s.count >= 2);
  if (sectors.length > 0 && sectors[0].averageRiskScore > 50) {
    const s = sectors[0];
    insights.push(
      `${s.industry} carries the highest average risk score (${
        s.averageRiskScore
      }) across ${s.count} customers, with ${Math.round(
        s.atRiskShare * 100
      )}% rated Amber or Red.`
    );
  }

  if (insights.length === 0) {
    insights.push(
      "No single driver is escalating the portfolio — risk contributions are evenly spread and stable across the trend window."
    );
  }

  return insights;
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
