// Client-side CSV parsing for the customer portfolio upload. Column names
// are matched flexibly (case-insensitive, whitespace-normalised) against a
// set of known aliases, since real-world exports vary in naming.

import Papa from "papaparse";
import type { CsvParseResult, RiskWeights } from "./types";
import { scoreCustomer } from "./riskScoring";

type LogicalColumn =
  | "customerId"
  | "customerName"
  | "industrySector"
  | "creditScore"
  | "repaymentStatus"
  | "loanBalance";

const COLUMN_ALIASES: Record<LogicalColumn, string[]> = {
  customerId: [
    "customer_id",
    "customerid",
    "id",
    "account_id",
    "account number",
    "customer id",
  ],
  customerName: ["customer_name", "customername", "name", "client name", "customer"],
  industrySector: ["industry_sector", "industry", "sector", "industry sector"],
  creditScore: ["credit_score", "creditscore", "credit score", "score", "bureau_score"],
  repaymentStatus: [
    "repayment_status",
    "repaymentstatus",
    "repayment status",
    "status",
    "arrears_status",
    "delinquency_status",
  ],
  loanBalance: [
    "loan_balance",
    "loanbalance",
    "loan balance",
    "balance",
    "exposure",
    "outstanding_balance",
  ],
};

function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchColumns(headers: string[]): {
  mapping: Partial<Record<LogicalColumn, string>>;
  missing: LogicalColumn[];
} {
  const normalisedHeaders = headers.map((h) => ({
    original: h,
    normalised: normaliseHeader(h),
  }));

  const mapping: Partial<Record<LogicalColumn, string>> = {};
  const missing: LogicalColumn[] = [];

  (Object.keys(COLUMN_ALIASES) as LogicalColumn[]).forEach((logical) => {
    const aliases = COLUMN_ALIASES[logical];
    const found = normalisedHeaders.find((h) => aliases.includes(h.normalised));
    if (found) {
      mapping[logical] = found.original;
    } else {
      missing.push(logical);
    }
  });

  return { mapping, missing };
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined || value === null) return null;
  const cleaned = value.replace(/[,$\s]/g, "");
  if (cleaned === "") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function parseCustomerCsv(
  csvText: string,
  weights: RiskWeights
): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = parsed.meta.fields ?? [];
  const { mapping, missing } = matchColumns(headers);

  if (missing.length > 0) {
    throw new Error(
      `The CSV is missing required column(s): ${missing.join(", ")}. ` +
        `Expected columns: CustomerID, CustomerName, Industry, CreditScore, RepaymentStatus, LoanBalance (column names are matched flexibly).`
    );
  }

  const rows = parsed.data;
  let rowsSkipped = 0;
  const customers = [];

  for (const row of rows) {
    const customerId = (row[mapping.customerId as string] ?? "").trim();
    const customerName = (row[mapping.customerName as string] ?? "").trim();
    const industrySector = (row[mapping.industrySector as string] ?? "").trim();
    const repaymentStatus = (row[mapping.repaymentStatus as string] ?? "").trim();
    const creditScore = parseNumber(row[mapping.creditScore as string]);
    const loanBalance = parseNumber(row[mapping.loanBalance as string]);

    if (!customerId || creditScore === null || loanBalance === null) {
      rowsSkipped += 1;
      continue;
    }

    customers.push(
      scoreCustomer(
        {
          customerId,
          customerName: customerName || customerId,
          industrySector: industrySector || "Unclassified",
          creditScore,
          repaymentStatus: repaymentStatus || "Unknown",
          loanBalance,
        },
        weights
      )
    );
  }

  return {
    customers,
    rowsSkipped,
    totalRows: rows.length,
  };
}
