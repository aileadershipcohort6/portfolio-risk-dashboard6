/**
 * CSV portfolio parsing. Column headers are matched flexibly (case- and
 * separator-insensitive) so the prototype accepts realistic bank extracts
 * without forcing an exact header row.
 */

import Papa from "papaparse";
import type { CsvParseResult, CustomerRecord } from "./types";

const COLUMN_ALIASES: Record<keyof CustomerRecord, string[]> = {
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

const REQUIRED_LABELS: Record<keyof CustomerRecord, string> = {
  customerId: "CustomerID",
  customerName: "CustomerName",
  industrySector: "Industry",
  creditScore: "CreditScore",
  repaymentStatus: "RepaymentStatus",
  loanBalance: "LoanBalance",
};

function normaliseHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map each logical field to the actual header present in the file. */
function resolveHeaders(headers: string[]) {
  const map = new Map<string, string>(); // normalised -> original
  headers.forEach((h) => map.set(normaliseHeader(h), h));

  const resolved: Partial<Record<keyof CustomerRecord, string>> = {};
  const missing: string[] = [];

  (Object.keys(COLUMN_ALIASES) as (keyof CustomerRecord)[]).forEach((field) => {
    const aliases = COLUMN_ALIASES[field].map(normaliseHeader);
    const hit = aliases.find((alias) => map.has(alias));
    if (hit) {
      resolved[field] = map.get(hit)!;
    } else {
      missing.push(REQUIRED_LABELS[field]);
    }
  });

  return { resolved, missing };
}

/** Strip currency symbols, thousands separators and stray whitespace. */
function toNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function parsePortfolioCsv(text: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  if (headers.length === 0) {
    throw new Error("The CSV file appears to be empty or has no header row.");
  }

  const { resolved, missing } = resolveHeaders(headers);
  if (missing.length > 0) {
    throw new Error(
      `Could not find required column(s): ${missing.join(", ")}. ` +
        `Columns found in the file: ${headers.join(", ")}.`,
    );
  }

  const customers: CustomerRecord[] = [];
  const warnings: string[] = [];
  let rowsSkipped = 0;

  parsed.data.forEach((row, index) => {
    const customerId = (row[resolved.customerId!] ?? "").toString().trim();
    const creditScore = toNumber(row[resolved.creditScore!]);
    const loanBalance = toNumber(row[resolved.loanBalance!]);

    // Skip — never silently coerce — rows missing an identifier or a number we
    // cannot score against. Skipped rows are reported back to the user.
    if (!customerId || creditScore === null || loanBalance === null) {
      rowsSkipped += 1;
      if (warnings.length < 5) {
        warnings.push(
          `Row ${index + 2} skipped (missing customer ID, credit score or loan balance).`,
        );
      }
      return;
    }

    customers.push({
      customerId,
      customerName:
        (row[resolved.customerName!] ?? "").toString().trim() || customerId,
      industrySector:
        (row[resolved.industrySector!] ?? "").toString().trim() ||
        "Unclassified",
      creditScore,
      repaymentStatus:
        (row[resolved.repaymentStatus!] ?? "").toString().trim() || "Unknown",
      loanBalance,
    });
  });

  if (customers.length === 0) {
    throw new Error(
      "No usable customer rows were found in the CSV. Check that credit scores and loan balances are numeric.",
    );
  }

  return {
    customers,
    rowsParsed: customers.length,
    rowsSkipped,
    warnings,
  };
}
