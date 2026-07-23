// Shared domain types for the Portfolio Risk Dashboard prototype.
// No backend types here — everything is computed client-side from an
// uploaded CSV (+ optional PDF) and lives only in memory.

export type RiskCategory = "Green" | "Amber" | "Red";

export interface RiskWeights {
  creditRiskWeight: number;
  repaymentRiskWeight: number;
  exposureWeight: number;
}

export interface RawCustomerRow {
  customerId: string;
  customerName: string;
  industrySector: string;
  creditScore: string;
  repaymentStatus: string;
  loanBalance: string;
}

export interface ScoredCustomer {
  customerId: string;
  customerName: string;
  industrySector: string;
  creditScore: number;
  repaymentStatus: string;
  loanBalance: number;
  creditScoreFactor: number;
  repaymentRiskFactor: number;
  exposureFactor: number;
  riskScore: number;
  category: RiskCategory;
}

export interface ExtractedRule {
  text: string;
}

export interface CsvParseResult {
  customers: ScoredCustomer[];
  rowsSkipped: number;
  totalRows: number;
}

export interface PdfParseResult {
  rawText: string;
  rules: ExtractedRule[];
  pageCount: number;
}

export interface TrendPoint {
  label: string;
  averageRiskScore: number;
}

export interface AnalysisResult {
  customers: ScoredCustomer[];
  rules: ExtractedRule[];
  weights: RiskWeights;
  csvFileName: string;
  pdfFileName: string | null;
  pdfPageCount: number | null;
  analysedAt: Date;
  isSampleData: boolean;
  pdfParseFailed?: boolean;
  pdfParseError?: string;
}
