import Papa from "papaparse";
import type { CsvParseResult, RawCustomerRow } from "./types";

// Accepted header aliases (case-insensitive, whitespace-normalised) for each
// required logical column.
const COLUMN_ALIASES: Record<keyof RawCustomerRow, string[]> = {
  customerId: ["customer_id", "customerid", "id", "account_id", "account number", "customer id"],
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
  loanBalance: ["loan_balance", "loanbalance", "loan balance", "balance", "exposure", "outstanding_balance"],
};

function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildHeaderMap(headers: string[]): Partial<Record<keyof RawCustomerRow, string>> {
  const normalisedToOriginal = new Map<string, string>();
  headers.forEach((h) => normalisedToOriginal.set(normaliseHeader(h), h));

  const map: Partial<Record<keyof RawCustomerRow, string>> = {};

  (Object.keys(COLUMN_ALIASES) as Array<keyof RawCustomerRow>).forEach((logicalCol) => {
    const aliases = [logicalCol.toLowerCase(), ...COLUMN_ALIASES[logicalCol]];
    for (const alias of aliases) {
      const normalisedAlias = normaliseHeader(alias);
      if (normalisedToOriginal.has(normalisedAlias)) {
        map[logicalCol] = normalisedToOriginal.get(normalisedAlias);
        break;
      }
    }
  });

  return map;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export async function parseCsv(file: File): Promise<CsvParseResult> {
  const text = await file.text();

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h,
  });

  const headers = parsed.meta.fields || [];
  const headerMap = buildHeaderMap(headers);

  const requiredCols: Array<keyof RawCustomerRow> = [
    "customerId",
    "customerName",
    "industrySector",
    "creditScore",
    "repaymentStatus",
    "loanBalance",
  ];

  const missing = requiredCols.filter((col) => !headerMap[col]);
  if (missing.length > 0) {
    throw new Error(
      `Could not find required column(s) in the CSV: ${missing.join(", ")}. ` +
        `Expected columns like CustomerID, CustomerName, Industry, CreditScore, RepaymentStatus, LoanBalance ` +
        `(column names are matched flexibly, but these could not be matched).`
    );
  }

  const customers: RawCustomerRow[] = [];
  let rowsSkipped = 0;

  for (const row of parsed.data) {
    const customerId = String(row[headerMap.customerId!] ?? "").trim();
    const customerName = String(row[headerMap.customerName!] ?? "").trim();
    const industrySector = String(row[headerMap.industrySector!] ?? "").trim() || "Unclassified";
    const repaymentStatus = String(row[headerMap.repaymentStatus!] ?? "").trim();
    const creditScore = parseNumber(row[headerMap.creditScore!]);
    const loanBalance = parseNumber(row[headerMap.loanBalance!]);

    if (!customerId || creditScore === null || loanBalance === null) {
      rowsSkipped += 1;
      continue;
    }

    customers.push({
      customerId,
      customerName: customerName || customerId,
      industrySector,
      creditScore,
      repaymentStatus,
      loanBalance,
    });
  }

  return {
    customers,
    rowsSkipped,
    totalRows: parsed.data.length,
  };
}
