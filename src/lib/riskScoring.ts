// ---------------------------------------------------------------------------
// THIS IS THE SINGLE FILE TO EDIT to change risk scoring behaviour: weights,
// thresholds, the credit score band, the exposure cap, and the repayment
// status lookup table all live here. Nothing else in the app hard-codes
// scoring logic — the UI reads these constants directly so the Upload page's
// "How risk is scored" card and the Dashboard's "Scoring Methodology" card
// always stay in sync with whatever is edited below.
// ---------------------------------------------------------------------------

import type { RawCustomerRow, RiskWeights, ScoredCustomer, RiskCategory } from "./types";

/**
 * Risk Score = (Credit Risk Weight x Credit Score Factor)
 *            + (Repayment Risk Weight x Repayment Status Factor)
 *            + (Exposure Weight x Loan Balance Factor)
 *
 * Rationale: credit history and repayment behaviour are the strongest
 * predictors of default, so they carry the majority of the weight equally.
 * Exposure reflects materiality (how much is at stake), not probability of
 * default, hence the lower weight.
 */
export const DEFAULT_WEIGHTS: RiskWeights = {
  creditRiskWeight: 0.4,
  repaymentRiskWeight: 0.4,
  exposureWeight: 0.2,
};

export const CREDIT_SCORE_MIN = 300;
export const CREDIT_SCORE_MAX = 850;

export const EXPOSURE_CAP = 500_000;

export const RISK_THRESHOLDS = {
  greenMax: 35,
  amberMax: 65,
};

/** Credit Score Factor: lower credit score => higher risk factor (0-100). */
export function creditScoreFactor(creditScore: number): number {
  const clamped = Math.min(Math.max(creditScore, CREDIT_SCORE_MIN), CREDIT_SCORE_MAX);
  return ((CREDIT_SCORE_MAX - clamped) / (CREDIT_SCORE_MAX - CREDIT_SCORE_MIN)) * 100;
}

/** Exposure Factor: loan balance relative to the exposure cap (0-100). */
export function exposureFactor(loanBalance: number): number {
  const balance = Math.max(loanBalance, 0);
  return (Math.min(balance, EXPOSURE_CAP) / EXPOSURE_CAP) * 100;
}

/**
 * Repayment Status Factor: free-text lookup table. Checked in priority
 * order (most specific label first) before falling back to a parsed
 * day-count bucket, then to a moderate-risk default of 50 for anything
 * unrecognised (never silently treated as zero risk).
 *
 * Note: "60 Days Past Due" (the exact literal label) maps to 60, while the
 * generic 60-89 day bucket maps to 75. This asymmetry is intentional
 * historical behaviour carried over from the source policy data, not a bug.
 */
export function repaymentRiskFactor(rawStatus: string): number {
  const status = (rawStatus || "").trim().toLowerCase();

  const exactRules: Array<[RegExp, number]> = [
    [/60\s*days?\s*past\s*due/i, 60],
    [/current|on[\s-]?time/i, 0],
    [/watchlist|grace/i, 20],
    [/default|write[\s-]?off/i, 100],
    [/non[\s-]?performing|npl/i, 95],
    [/90\s*\+?\s*days?/i, 90],
    [/60\s*[-–to]*\s*89\s*days?|60\s*days?/i, 75],
    [/30\s*days?/i, 55],
    [/1\s*[-–to]*\s*29\s*days?/i, 35],
  ];

  for (const [pattern, value] of exactRules) {
    if (pattern.test(status)) return value;
  }

  const dayMatch = status.match(/(\d+)\s*\+?\s*days?/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    if (days <= 0) return 0;
    if (days < 30) return 35;
    if (days < 60) return 55;
    if (days < 90) return 75;
    return 90;
  }

  // Unrecognised text with no parseable day count: moderate risk, never
  // silently ignored.
  return 50;
}

export function categoriseRisk(riskScore: number): RiskCategory {
  if (riskScore <= RISK_THRESHOLDS.greenMax) return "Green";
  if (riskScore <= RISK_THRESHOLDS.amberMax) return "Amber";
  return "Red";
}

export function scoreCustomer(
  row: RawCustomerRow,
  weights: RiskWeights = DEFAULT_WEIGHTS
): ScoredCustomer {
  const creditFactor = creditScoreFactor(row.creditScore);
  const repaymentFactor = repaymentRiskFactor(row.repaymentStatus);
  const expFactor = exposureFactor(row.loanBalance);

  const riskScore =
    weights.creditRiskWeight * creditFactor +
    weights.repaymentRiskWeight * repaymentFactor +
    weights.exposureWeight * expFactor;

  return {
    ...row,
    creditScoreFactor: creditFactor,
    repaymentRiskFactor: repaymentFactor,
    exposureFactor: expFactor,
    riskScore,
    category: categoriseRisk(riskScore),
  };
}

export function scoreCustomers(
  rows: RawCustomerRow[],
  weights: RiskWeights = DEFAULT_WEIGHTS
): ScoredCustomer[] {
  return rows.map((row) => scoreCustomer(row, weights));
}
