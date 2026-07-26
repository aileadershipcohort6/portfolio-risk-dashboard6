/** Shared domain types for the portfolio risk prototype. */

export type RiskCategory = "Green" | "Amber" | "Red";

/** A single portfolio row as read from the uploaded CSV. */
export interface CustomerRecord {
  customerId: string;
  customerName: string;
  industrySector: string;
  creditScore: number;
  repaymentStatus: string;
  loanBalance: number;
}

/**
 * A customer record plus its scoring breakdown. Each factor is exposed
 * independently so the UI can show *why* a customer scored the way it did,
 * not just the final number.
 */
export interface ScoredCustomer extends CustomerRecord {
  creditScoreFactor: number;
  repaymentRiskFactor: number;
  exposureFactor: number;
  riskScore: number;
  category: RiskCategory;
}

export interface RiskWeights {
  creditRiskWeight: number;
  repaymentRiskWeight: number;
  exposureWeight: number;
}

export interface RiskThresholds {
  greenMax: number;
  amberMax: number;
}

/** A policy statement pulled out of the uploaded lending policy PDF. */
export interface ExtractedRule {
  id: string;
  text: string;
  keyword: string;
}

export interface CsvParseResult {
  customers: CustomerRecord[];
  rowsParsed: number;
  rowsSkipped: number;
  warnings: string[];
}

export interface PdfParseResult {
  rawText: string;
  rules: ExtractedRule[];
  pageCount: number;
}

/** The single object the whole dashboard renders from. */
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
