/**
 * riskScoring.ts — THE single file to edit to change how portfolio risk is
 * scored (weights, thresholds, or the repayment-status lookup table).
 * Nothing in the UI hard-codes these numbers — every page reads the
 * constants exported from this file, so changes here propagate everywhere.
 *
 * Risk Score = (Credit Risk Weight x Credit Score Factor)
 *            + (Repayment Risk Weight x Repayment Status Factor)
 *            + (Exposure Weight x Loan Balance Factor)
 */

import type { RiskCategory, RiskWeights, ScoredCustomer } from "./types";

// Credit history and repayment behaviour are the strongest predictors of
// default, so they carry the most weight; exposure reflects materiality
// (how much is at stake), not probability of default, hence the lower
// weight. Weights must sum to 1.
export const DEFAULT_WEIGHTS: RiskWeights = {
  creditRiskWeight: 0.4,
  repaymentRiskWeight: 0.4,
  exposureWeight: 0.2,
};

export const CREDIT_SCORE_MIN = 300;
export const CREDIT_SCORE_MAX = 850;

// A prototype-scale cap used to normalise loan balance into a 0-100
// materiality factor. Balances above this are treated as maximally material.
export const EXPOSURE_CAP = 500_000;

export const RISK_THRESHOLDS = {
  greenMax: 35,
  amberMax: 65,
};

/**
 * Credit Score Factor — lower bureau score = higher risk. Clamp the score
 * into the valid band first, then invert/normalise onto a 0-100 scale.
 */
export function creditScoreFactor(creditScore: number): number {
  const clamped = Math.min(
    Math.max(creditScore, CREDIT_SCORE_MIN),
    CREDIT_SCORE_MAX
  );
  return (
    ((CREDIT_SCORE_MAX - clamped) / (CREDIT_SCORE_MAX - CREDIT_SCORE_MIN)) *
    100
  );
}

/**
 * Exposure Factor — loan balance normalised against EXPOSURE_CAP.
 * Reflects materiality (how much is at stake), not probability of default.
 */
export function exposureFactor(loanBalance: number): number {
  const cappedBalance = Math.min(Math.max(loanBalance, 0), EXPOSURE_CAP);
  return (cappedBalance / EXPOSURE_CAP) * 100;
}

/**
 * Repayment Status Factor — free-text lookup, since real-world loan
 * servicing systems export arrears status as inconsistent free text rather
 * than a clean enum. Order matters: more specific / more severe patterns
 * are checked first.
 *
 * NOTE ON THE 60-DAY ASYMMETRY: a general "60 days" statement (e.g. "60
 * Days Late") falls in the 60-89 day band and scores 75, but the specific
 * literal label "60 Days Past Due" scores 60. This is intentional history
 * carried over from the original policy mapping, not a bug to "fix" —
 * keep both entries as-is.
 */
export function repaymentRiskFactor(rawStatus: string): number {
  const status = (rawStatus ?? "").trim().toLowerCase();

  if (/write[\s-]?off/.test(status) || /default/.test(status)) return 100;
  if (/non-?performing/.test(status) || /\bnpl\b/.test(status)) return 95;
  if (status === "60 days past due") return 60;
  if (/current/.test(status) || /on time/.test(status)) return 0;
  if (/watchlist/.test(status) || /grace/.test(status)) return 20;

  // Fall back to parsing an explicit day count out of the free text, e.g.
  // "30 Days Late", "1-29 Days Past Due", "90+ Days Late".
  const dayMatch = status.match(/(\d+)\s*\+?\s*(?:-\s*\d+\s*)?days?/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    const hasPlus = /\d+\s*\+/.test(status);
    if (hasPlus || days >= 90) return 90;
    if (days >= 60) return 75;
    if (days >= 30) return 55;
    if (days >= 1) return 35;
    return 0;
  }

  // Unrecognised text with no parseable day count is never silently
  // ignored — treat it as moderate risk.
  return 50;
}

export function categorize(riskScore: number): RiskCategory {
  if (riskScore <= RISK_THRESHOLDS.greenMax) return "Green";
  if (riskScore <= RISK_THRESHOLDS.amberMax) return "Amber";
  return "Red";
}

export interface ScoreInput {
  customerId: string;
  customerName: string;
  industrySector: string;
  creditScore: number;
  repaymentStatus: string;
  loanBalance: number;
}

/**
 * Compute the full risk breakdown for one customer. All three factors are
 * returned individually (not just the final blended score) so the UI can
 * show how the number was derived, not just the result.
 */
export function scoreCustomer(
  input: ScoreInput,
  weights: RiskWeights = DEFAULT_WEIGHTS
): ScoredCustomer {
  const creditFactor = creditScoreFactor(input.creditScore);
  const repaymentFactor = repaymentRiskFactor(input.repaymentStatus);
  const exposureFactorValue = exposureFactor(input.loanBalance);

  const riskScore =
    weights.creditRiskWeight * creditFactor +
    weights.repaymentRiskWeight * repaymentFactor +
    weights.exposureWeight * exposureFactorValue;

  return {
    customerId: input.customerId,
    customerName: input.customerName,
    industrySector: input.industrySector,
    creditScore: input.creditScore,
    repaymentStatus: input.repaymentStatus,
    loanBalance: input.loanBalance,
    creditScoreFactor: creditFactor,
    repaymentRiskFactor: repaymentFactor,
    exposureFactor: exposureFactorValue,
    riskScore,
    category: categorize(riskScore),
  };
}
