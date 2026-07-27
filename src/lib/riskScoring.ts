/**
 * ============================================================================
 * RISK SCORING ENGINE — THIS IS THE SINGLE FILE TO EDIT
 * ============================================================================
 *
 * To change how customers are scored or categorised, edit the constants in
 * this file only. Nothing else in the app hard-codes a weight, a threshold or
 * a band boundary — the Upload page's "How risk is scored" card and the
 * dashboard's "Scoring Methodology" card both read these values at runtime.
 *
 *   Risk Score = (Credit Risk Weight    x Credit Score Factor)
 *              + (Repayment Risk Weight x Repayment Status Factor)
 *              + (Exposure Weight       x Loan Balance Factor)
 *
 * All three factors are normalised to a 0–100 scale where higher = riskier,
 * so the final score is also 0–100.
 *
 * Things you are most likely to want to change:
 *   - DEFAULT_WEIGHTS ....... relative importance of the three factors
 *   - RISK_THRESHOLDS ....... where Green becomes Amber, and Amber becomes Red
 *   - EXPOSURE_CAP .......... the loan balance treated as "maximum exposure"
 *   - REPAYMENT_STATUS_FACTORS ... risk score for each arrears status label
 */

import type {
  CustomerRecord,
  RiskCategory,
  RiskThresholds,
  RiskWeights,
  ScoredCustomer,
} from "./types";

/**
 * Weights must sum to 1.
 *
 * Rationale: credit history and repayment behaviour are the strongest
 * predictors of default, so they carry equal and dominant weight. Exposure
 * reflects materiality (how much is at stake) rather than probability (how
 * likely a loss is), hence the deliberately lower weight — a large, perfectly
 * performing loan should not be flagged as high risk on size alone.
 */
export const DEFAULT_WEIGHTS: RiskWeights = {
  creditRiskWeight: 0.4,
  repaymentRiskWeight: 0.4,
  exposureWeight: 0.2,
};

/**
 * Score bands. Green 0–35, Amber 36–65, Red 66–100.
 *
 * Rationale: the Amber band is deliberately wide so that a customer needs a
 * genuinely poor credit score AND arrears to reach Red — Red is an escalation
 * signal for a relationship manager, not a routine label.
 */
export const RISK_THRESHOLDS: RiskThresholds = {
  greenMax: 35,
  amberMax: 65,
};

/** Standard credit bureau scale used to normalise the credit score factor. */
export const CREDIT_SCORE_MIN = 300;
export const CREDIT_SCORE_MAX = 850;

/**
 * Loan balance treated as "full" exposure risk (100). Balances above this are
 * clamped rather than allowed to dominate the blended score.
 */
export const EXPOSURE_CAP = 500_000;

/**
 * Repayment status risk factors (0 = performing, 100 = written off).
 * Keys are lower-cased and whitespace-normalised before lookup.
 */
export const REPAYMENT_STATUS_FACTORS: Record<string, number> = {
  current: 0,
  "on time": 0,
  "up to date": 0,
  performing: 0,
  watchlist: 20,
  grace: 20,
  "grace period": 20,
  "1-29 days": 35,
  "1-29 days late": 35,
  "30 days": 55,
  "30 days late": 55,
  "30 days past due": 55,
  "30-59 days": 55,
  "60 days": 75,
  "60 days late": 75,
  "60-89 days": 75,
  // Retained deliberately: the bare "60 days past due" label scores lower than
  // the "60-89 days" band. This asymmetry is existing calibration history, not
  // a bug — do not "fix" it without re-baselining the sample portfolio.
  "60 days past due": 60,
  "90+ days": 90,
  "90+ days late": 90,
  "90 days": 90,
  "90+ days past due": 90,
  default: 100,
  "write-off": 100,
  "write off": 100,
  "charged off": 100,
  "non-performing": 95,
  "non performing": 95,
  npl: 95,
};

/** Applied when a status label is unrecognised — moderate risk, never ignored. */
export const UNKNOWN_REPAYMENT_STATUS_FACTOR = 50;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Credit Score Factor — inverts the bureau score onto a 0–100 risk scale.
 * A score of 850 gives 0 (no risk), 300 gives 100 (maximum risk).
 */
export function creditScoreFactor(score: number): number {
  const bounded = clamp(score, CREDIT_SCORE_MIN, CREDIT_SCORE_MAX);
  return round1(
    ((CREDIT_SCORE_MAX - bounded) / (CREDIT_SCORE_MAX - CREDIT_SCORE_MIN)) * 100
  );
}

/**
 * Repayment Status Factor — free-text lookup, tolerant of label variations.
 * Falls back to parsing a day count out of the text, then to a moderate
 * default so an unfamiliar label is never silently treated as zero risk.
 */
export function repaymentRiskFactor(status: string): number {
  const normalised = (status ?? "").toString().trim().toLowerCase();
  if (!normalised) return UNKNOWN_REPAYMENT_STATUS_FACTOR;

  if (normalised in REPAYMENT_STATUS_FACTORS) {
    return REPAYMENT_STATUS_FACTORS[normalised];
  }

  // Try a contains-match against known labels (e.g. "Arrears - 30 days late").
  for (const [label, factor] of Object.entries(REPAYMENT_STATUS_FACTORS)) {
    if (label.length > 3 && normalised.includes(label)) return factor;
  }

  // Last resort: pull a day count out of the text (e.g. "45 days overdue").
  const days = normalised.match(/(\d+)\s*\+?\s*day/);
  if (days) {
    const n = Number(days[1]);
    if (n >= 90) return 90;
    if (n >= 60) return 75;
    if (n >= 30) return 55;
    if (n >= 1) return 35;
    return 0;
  }

  return UNKNOWN_REPAYMENT_STATUS_FACTOR;
}

/**
 * Exposure Factor — loan balance as a share of the exposure cap, 0–100.
 * Materiality, not probability of loss.
 */
export function exposureFactor(loanBalance: number): number {
  const bounded = clamp(loanBalance, 0, EXPOSURE_CAP);
  return round1((bounded / EXPOSURE_CAP) * 100);
}

/** Maps a 0–100 risk score onto the Green / Amber / Red bands. */
export function categoriseRisk(
  score: number,
  thresholds: RiskThresholds = RISK_THRESHOLDS
): RiskCategory {
  if (score <= thresholds.greenMax) return "Green";
  if (score <= thresholds.amberMax) return "Amber";
  return "Red";
}

/** Scores one customer record, exposing every intermediate factor. */
export function scoreCustomer(
  customer: CustomerRecord,
  weights: RiskWeights = DEFAULT_WEIGHTS,
  thresholds: RiskThresholds = RISK_THRESHOLDS
): ScoredCustomer {
  const credit = creditScoreFactor(customer.creditScore);
  const repayment = repaymentRiskFactor(customer.repaymentStatus);
  const exposure = exposureFactor(customer.loanBalance);

  const riskScore = round1(
    weights.creditRiskWeight * credit +
      weights.repaymentRiskWeight * repayment +
      weights.exposureWeight * exposure
  );

  return {
    ...customer,
    creditScoreFactor: credit,
    repaymentRiskFactor: repayment,
    exposureFactor: exposure,
    riskScore,
    category: categoriseRisk(riskScore, thresholds),
  };
}

/** Scores a whole portfolio. */
export function scorePortfolio(
  customers: CustomerRecord[],
  weights: RiskWeights = DEFAULT_WEIGHTS,
  thresholds: RiskThresholds = RISK_THRESHOLDS
): ScoredCustomer[] {
  return customers.map((c) => scoreCustomer(c, weights, thresholds));
}

/** Human-readable formula string, used by both explainer cards. */
export const RISK_FORMULA =
  "Risk Score = (Credit Risk Weight x Credit Score Factor) + (Repayment Risk Weight x Repayment Status Factor) + (Exposure Weight x Loan Balance Factor)";
