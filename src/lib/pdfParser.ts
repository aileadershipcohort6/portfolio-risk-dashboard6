/**
 * Client-side lending policy PDF parsing.
 *
 * Text is extracted in the browser with pdfjs-dist (worker bundled as a local
 * asset, never a CDN, so this works fully offline). Rule extraction is pure
 * keyword + sentence-splitting heuristics — there are no AI/LLM or network
 * calls of any kind here.
 */

import type { ExtractedRule } from "./types";

/** Keywords that mark a sentence as a lending/risk rule worth surfacing. */
const RULE_KEYWORDS: string[] = [
  "credit score",
  "debt-to-income",
  "debt to income",
  "dti",
  "loan-to-value",
  "loan to value",
  "lvr",
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

export interface PdfParseResult {
  rawText: string;
  rules: ExtractedRule[];
  pageCount: number;
}

/**
 * pdfjs-dist v6 relies on Promise.withResolvers, which is undefined on
 * browsers older than Safari 17.4 / Chrome 119 / Firefox 121 and throws an
 * opaque "undefined is not a function" the moment a PDF is parsed. Polyfill
 * defensively before touching pdfjs.
 */
function ensurePromiseWithResolvers() {
  const P = Promise as unknown as {
    withResolvers?: <T>() => {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  };
  if (typeof P.withResolvers !== "function") {
    P.withResolvers = function <T>() {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }
}

/** Splits raw PDF text into candidate statements and keeps the rule-like ones. */
export function extractRulesFromText(text: string): ExtractedRule[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const statements = cleaned
    .split(/(?:\.\s|;\s)/)
    .map((s) => s.trim().replace(/\s*[.;]$/, ""))
    .filter(
      (s) =>
        s.length >= MIN_STATEMENT_LENGTH && s.length <= MAX_STATEMENT_LENGTH
    );

  const rules: ExtractedRule[] = [];
  const seen = new Set<string>();

  for (const statement of statements) {
    const lower = statement.toLowerCase();
    const keyword = RULE_KEYWORDS.find((k) => lower.includes(k));
    if (!keyword) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);

    rules.push({
      id: `rule-${rules.length + 1}`,
      text: statement.endsWith(".") ? statement : `${statement}.`,
      keyword,
    });

    if (rules.length >= MAX_RULES) break;
  }

  return rules;
}

export async function parsePdfFile(file: File): Promise<PdfParseResult> {
  ensurePromiseWithResolvers();

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  let rawText = "";
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    rawText += `${pageText}\n`;
  }

  return {
    rawText,
    rules: extractRulesFromText(rawText),
    pageCount: doc.numPages,
  };
}
