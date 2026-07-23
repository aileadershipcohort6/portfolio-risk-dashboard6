// Client-side PDF rule extraction, entirely offline: pdfjs-dist for text
// extraction, then pure keyword + sentence-splitting heuristics to surface
// policy-relevant statements. No LLM/API calls of any kind.

import type { ExtractedRule, PdfParseResult } from "./types";

const RULE_KEYWORDS = [
  "credit score",
  "debt-to-income",
  "debt to income",
  "dti",
  "loan-to-value",
  "loan to value",
  "ltv",
  "delinquen",
  "default",
  "past due",
  "arrears",
  "watchlist",
  "covenant",
  "exposure limit",
  "concentration limit",
  "threshold",
  "risk rating",
  "risk grade",
  "write-off",
  "write off",
  "provisioning",
  "collateral",
  "minimum",
  "maximum",
];

const MAX_RULES = 25;
const MIN_STATEMENT_LENGTH = 15;
const MAX_STATEMENT_LENGTH = 320;

// pdfjs-dist v6 requires Promise.withResolvers, which is undefined on
// browsers older than Safari 17.4 / Chrome 119 / Firefox 121. Polyfill it
// defensively before touching pdfjs-dist so parsing fails gracefully
// instead of throwing a bare "undefined is not a function".
function ensurePromiseWithResolvers() {
  if (typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers === "function") {
    return;
  }
  (Promise as unknown as { withResolvers: <T>() => {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
  } }).withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

function splitIntoStatements(text: string): string[] {
  return text
    .split(/(?:\. |; )/g)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= MIN_STATEMENT_LENGTH && s.length <= MAX_STATEMENT_LENGTH);
}

function extractRules(text: string): ExtractedRule[] {
  const statements = splitIntoStatements(text);
  const rules: ExtractedRule[] = [];

  for (const statement of statements) {
    const lower = statement.toLowerCase();
    const isRule = RULE_KEYWORDS.some((keyword) => lower.includes(keyword));
    if (isRule) {
      rules.push({ text: statement });
      if (rules.length >= MAX_RULES) break;
    }
  }

  return rules;
}

/**
 * Extract policy text + heuristic rule statements from a PDF, entirely in
 * the browser. This is best-effort: any failure (corrupt file, scanned
 * image-only PDF, missing polyfill support) must be caught by the caller —
 * PDF extraction is optional and must never block CSV analysis.
 */
export async function parsePolicyPdf(file: File): Promise<PdfParseResult> {
  ensurePromiseWithResolvers();

  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let rawText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    rawText += `${pageText} `;
  }

  const rules = extractRules(rawText);

  return {
    rawText,
    rules,
    pageCount: pdf.numPages,
  };
}
