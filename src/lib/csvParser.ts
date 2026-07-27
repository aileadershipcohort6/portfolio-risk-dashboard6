/**
 * CSV portfolio parsing. Runs entirely in the browser via papaparse.
 *
 * Column names are matched flexibly against a list of accepted aliases so a
 * portfolio extract does not have to be renamed before upload.
 */

import Papa from "papaparse";
import type { CustomerRecord } from "./types";

type LogicalColumn =
  | "customerId"
  | "customerName"
  | "industrySector"
  | "creditScore"
  | "repaymentStatus"
  | "loanBalance";

const COLUMN_ALIASES: Record<LogicalColumn, string[]> = {
  customerId: [
    "customerid",
    "customer id",
    "customer_id",
    "id",
    "account_id",
    "account id",
    "account number",
  ],
  customerName: [
    "customername",
    "customer name",
    "customer_name",
    "name",
    "client name",
    "customer",
  ],
  industrySector: [
    "industrysector",
    "industry sector",
    "industry_sector",
    "industry",
    "sector",
  ],
  creditScore: [
    "creditscore",
    "credit score",
    "credit_score",
    "score",
    "bureau_score",
    "bureau score",
  ],
  repaymentStatus: [
    "repaymentstatus",
    "repayment status",
    "repayment_status",
    "status",
    "arrears_status",
    "arrears status",
    "delinquency_status",
    "delinquency status",
  ],
  loanBalance: [
    "loanbalance",
    "loan balance",
    "loan_balance",
    "balance",
    "exposure",
    "outstanding_balance",
    "outstanding balance",
  ],
};

const REQUIRED_LABELS: Record<LogicalColumn, string> = {
  customerId: "CustomerID",
  customerName: "CustomerName",
  industrySector: "Industry",
  creditScore: "CreditScore",
  repaymentStatus: "RepaymentStatus",
  loanBalance: "LoanBalance",
};

const normaliseHeader = (header: string) =>
  header.replace(/^﻿/, "").trim().toLowerCase().replace(/\s+/g, " ");

/** Strips currency symbols, thousands separators and stray spaces. */
function parseNumeric(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = raw.toString().replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export interface CsvParseResult {
  customers: CustomerRecord[];
  rowsSkipped: number;
  totalRows: number;
}

export function parseCsvText(text: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normaliseHeader,
  });

  const headers = (parsed.meta.fields ?? []).map(normaliseHeader);

  // Resolve each logical column to an actual header in the file.
  const mapping = {} as Record<LogicalColumn, string | undefined>;
  const missing: string[] = [];

  (Object.keys(COLUMN_ALIASES) as LogicalColumn[]).forEach((key) => {
    const match = headers.find((h) => COLUMN_ALIASES[key].includes(h));
    mapping[key] = match;
    if (!match) missing.push(REQUIRED_LABELS[key]);
  });

  if (missing.length > 0) {
    throw new Error(
      `Could not find required column(s) in the CSV: ${missing.join(
        ", "
      )}. Found headers: ${headers.join(", ") || "(none)"}.`
    );
  }

  const rows = parsed.data ?? [];
  const customers: CustomerRecord[] = [];
  let rowsSkipped = 0;

  for (const row of rows) {
    const customerId = (row[mapping.customerId!] ?? "").toString().trim();
    const creditScore = parseNumeric(row[mapping.creditScore!]);
    const loanBalance = parseNumeric(row[mapping.loanBalance!]);

    // A row missing an ID, a score or a balance cannot be scored — skip it and
    // report the count rather than failing the whole upload.
    if (!customerId || creditScore === null || loanBalance === null) {
      rowsSkipped += 1;
      continue;
    }

    customers.push({
      customerId,
      customerName:
        (row[mapping.customerName!] ?? "").toString().trim() || customerId,
      industrySector:
        (row[mapping.industrySector!] ?? "").toString().trim() || "Unclassified",
      creditScore,
      repaymentStatus:
        (row[mapping.repaymentStatus!] ?? "").toString().trim() || "Unknown",
      loanBalance,
    });
  }

  if (customers.length === 0) {
    throw new Error(
      "No scoreable customer rows were found in the CSV. Check that credit scores and loan balances contain numbers."
    );
  }

  return { customers, rowsSkipped, totalRows: rows.length };
}

export async function parseCsvFile(file: File): Promise<CsvParseResult> {
  const text = await file.text();
  return parseCsvText(text);
}
