/**
 * ============================================================================
 * RISK SCORING ENGINE — THIS IS THE SINGLE FILE TO EDIT to change scoring
 * behaviour (weights, factor scales, or Green/Amber/Red thresholds).
 * ============================================================================
 *
 * Risk Score = (Credit Risk Weight   x Credit Score Factor)
 *            + (Repayment Risk Weight x Repayment Status Factor)
 *            + (Exposure Weight       x Loan Balance Factor)
 *
 * All three factors are normalised to a 0-100 scale where 0 = lowest risk and
 * 100 = highest risk, so the weighted score is also 0-100 and directly
 * comparable across customers.
 */

import type {
  CustomerRecord,
  RiskCategory,
  RiskThresholds,
  RiskWeights,
  ScoredCustomer,
} from "./types";

/**
 * Default weights. Must sum to 1.
 *
 * Rationale: credit history and repayment behaviour are the strongest
 * predictors of default, so they carry equal, dominant weight. Exposure
 * reflects materiality (how much is at stake), not probability of loss, hence
 * the deliberately lower weight — a large, well-performing loan should not be
 * scored as high risk simply because it is large.
 */
export const DEFAULT_WEIGHTS: RiskWeights = {
  creditRiskWeight: 0.4,
  repaymentRiskWeight: 0.4,
  exposureWeight: 0.2,
};

/** Category thresholds: Green 0-35, Amber 36-65, Red 66-100. */
export const RISK_THRESHOLDS: RiskThresholds = {
  greenMax: 35,
  amberMax: 65,
};

/** Credit score band used to normalise the credit factor. */
export const CREDIT_SCORE_MIN = 300;
export const CREDIT_SCORE_MAX = 850;

/**
 * Exposure above this cap is treated as equally material. Concentrating the
 * scale below the cap keeps the factor meaningful for the bulk of a portfolio
 * instead of letting one very large facility flatten everyone else.
 */
export const EXPOSURE_CAP = 500_000;

/**
 * Repayment status factor lookup. Free-text CSV values are normalised
 * (lowercased, punctuation stripped) and matched against these keys.
 */
const REPAYMENT_STATUS_FACTORS: Record<string, number> = {
  current: 0,
  "on time": 0,
  "up to date": 0,
  performing: 0,
  watchlist: 20,
  grace: 20,
  "grace period": 20,
  "1-29 days late": 35,
  "1 29 days late": 35,
  "30 days late": 55,
  "30 days past due": 55,
  "30+ days late": 55,
  "60 days late": 75,
  "60-89 days late": 75,
  "60 days past due": 60,
  "90 days late": 90,
  "90+ days late": 90,
  "90+ days past due": 90,
  default: 100,
  "write-off": 100,
  "write off": 100,
  "non-performing": 95,
  "non performing": 95,
  npl: 95,
};

/** Unrecognised, unparseable status text — moderate risk, never ignored. */
export const UNKNOWN_REPAYMENT_FACTOR = 50;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Credit Score Factor: a low credit score is high risk, so the scale is
 * inverted across the 300-850 band.
 */
export function creditScoreFactor(score: number): number {
  const banded = clamp(score, CREDIT_SCORE_MIN, CREDIT_SCORE_MAX);
  return (
    ((CREDIT_SCORE_MAX - banded) / (CREDIT_SCORE_MAX - CREDIT_SCORE_MIN)) * 100
  );
}

/** Exposure Factor: linear up to the cap, flat above it. */
export function exposureFactor(loanBalance: number): number {
  const positive = Math.max(0, loanBalance);
  return (Math.min(positive, EXPOSURE_CAP) / EXPOSURE_CAP) * 100;
}

/**
 * Repayment Status Factor. Falls back to reading a day count out of the text
 * (e.g. "arrears 45 days") before defaulting to moderate risk, so unfamiliar
 * labels still land somewhere sensible rather than scoring zero.
 */
export function repaymentRiskFactor(status: string): number {
  const normalised = (status ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9+\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalised) return UNKNOWN_REPAYMENT_FACTOR;

  if (normalised in REPAYMENT_STATUS_FACTORS) {
    return REPAYMENT_STATUS_FACTORS[normalised];
  }

  // Substring match, longest key first so "90+ days late" wins over "days late".
  const keys = Object.keys(REPAYMENT_STATUS_FACTORS).sort(
    (a, b) => b.length - a.length,
  );
  for (const key of keys) {
    if (normalised.includes(key)) return REPAYMENT_STATUS_FACTORS[key];
  }

  // Last resort: derive from any day count present in the label.
  const dayMatch = normalised.match(/(\d{1,3})\s*\+?\s*day/);
  if (dayMatch) {
    const days = Number(dayMatch[1]);
    if (days >= 90) return 90;
    if (days >= 60) return 75;
    if (days >= 30) return 55;
    if (days >= 1) return 35;
    return 0;
  }

  return UNKNOWN_REPAYMENT_FACTOR;
}

export function categoriseRisk(
  score: number,
  thresholds: RiskThresholds = RISK_THRESHOLDS,
): RiskCategory {
  if (score <= thresholds.greenMax) return "Green";
  if (score <= thresholds.amberMax) return "Amber";
  return "Red";
}

/** Score a single customer, exposing every intermediate factor. */
export function scoreCustomer(
  customer: CustomerRecord,
  weights: RiskWeights = DEFAULT_WEIGHTS,
): ScoredCustomer {
  const credit = creditScoreFactor(customer.creditScore);
  const repayment = repaymentRiskFactor(customer.repaymentStatus);
  const exposure = exposureFactor(customer.loanBalance);

  const riskScore =
    weights.creditRiskWeight * credit +
    weights.repaymentRiskWeight * repayment +
    weights.exposureWeight * exposure;

  const rounded = Math.round(riskScore * 10) / 10;

  return {
    ...customer,
    creditScoreFactor: Math.round(credit * 10) / 10,
    repaymentRiskFactor: Math.round(repayment * 10) / 10,
    exposureFactor: Math.round(exposure * 10) / 10,
    riskScore: rounded,
    category: categoriseRisk(rounded),
  };
}

export function scoreCustomers(
  customers: CustomerRecord[],
  weights: RiskWeights = DEFAULT_WEIGHTS,
): ScoredCustomer[] {
  return customers.map((customer) => scoreCustomer(customer, weights));
}

/** Weights as whole percentages, for display in the UI. */
export function weightsAsPercent(weights: RiskWeights = DEFAULT_WEIGHTS) {
  return {
    credit: Math.round(weights.creditRiskWeight * 100),
    repayment: Math.round(weights.repaymentRiskWeight * 100),
    exposure: Math.round(weights.exposureWeight * 100),
  };
}
