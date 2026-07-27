/**
 * Shared domain types for the Portfolio Risk Dashboard.
 *
 * All types are plain client-side data structures — nothing here is persisted
 * to a server, a database, or browser storage.
 */

export type RiskCategory = "Green" | "Amber" | "Red";

/** A single customer row as read from the uploaded CSV, after normalisation. */
export interface CustomerRecord {
  customerId: string;
  customerName: string;
  industrySector: string;
  creditScore: number;
  repaymentStatus: string;
  loanBalance: number;
}

/** A customer row with the risk engine's output attached. */
export interface ScoredCustomer extends CustomerRecord {
  /** 0–100, higher = riskier. Derived from credit score band. */
  creditScoreFactor: number;
  /** 0–100, higher = riskier. Derived from the repayment status text. */
  repaymentRiskFactor: number;
  /** 0–100, higher = more material. Derived from loan balance vs the cap. */
  exposureFactor: number;
  /** Weighted blend of the three factors above, 0–100. */
  riskScore: number;
  category: RiskCategory;
}

/** Weights applied to each factor. Must sum to 1. */
export interface RiskWeights {
  creditRiskWeight: number;
  repaymentRiskWeight: number;
  exposureWeight: number;
}

/** Score boundaries between the three risk categories. */
export interface RiskThresholds {
  greenMax: number;
  amberMax: number;
}

/** A policy statement pulled out of the uploaded PDF by keyword heuristics. */
export interface ExtractedRule {
  id: string;
  text: string;
  keyword: string;
}

/** The result of one Run Analysis click. Lives in React state only. */
export interface AnalysisResult {
  customers: ScoredCustomer[];
  rules: ExtractedRule[];
  weights: RiskWeights;
  csvFileName: string;
  pdfFileName: string | null;
  pdfPageCount: number | null;
  pdfParseFailed: boolean;
  rowsSkipped: number;
  analysedAt: Date;
  isSampleData: boolean;
}
