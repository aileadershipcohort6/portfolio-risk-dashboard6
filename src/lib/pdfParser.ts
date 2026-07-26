/**
 * Client-side lending policy PDF reading.
 *
 * Text extraction runs entirely in the browser via pdfjs-dist (worker bundled
 * as a local asset, never a CDN, so this works fully offline). Rule extraction
 * is deliberately keyword + sentence heuristics only — there are no LLM or
 * external API calls anywhere in this path.
 */

import type { ExtractedRule, PdfParseResult } from "./types";

/** Keywords that mark a sentence as a lending / risk rule worth surfacing. */
const RULE_KEYWORDS = [
  "credit score",
  "debt-to-income",
  "debt to income",
  "dti",
  "loan-to-value",
  "loan to value",
  "ltv",
  "lvr",
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

/**
 * pdfjs-dist v6 relies on Promise.withResolvers, which is missing on browsers
 * older than Safari 17.4 / Chrome 119 / Firefox 121 and fails with a bare
 * "undefined is not a function". Polyfill defensively before loading pdfjs.
 */
function ensurePromiseWithResolvers() {
  const P = Promise as unknown as {
    withResolvers?: <T>() => {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  };
  if (typeof P.withResolvers === "function") return;
  P.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

/** Split raw policy text into candidate statements. */
export function extractRulesFromText(rawText: string): ExtractedRule[] {
  const cleaned = rawText.replace(/\s+/g, " ").trim();
  const statements = cleaned
    .split(/(?:\.\s|;\s)/)
    .map((s) => s.trim().replace(/[.;]+$/, "").trim())
    .filter(
      (s) =>
        s.length >= MIN_STATEMENT_LENGTH && s.length <= MAX_STATEMENT_LENGTH,
    );

  const rules: ExtractedRule[] = [];
  const seen = new Set<string>();

  for (const statement of statements) {
    if (rules.length >= MAX_RULES) break;
    const lower = statement.toLowerCase();
    const keyword = RULE_KEYWORDS.find((k) => lower.includes(k));
    if (!keyword) continue;
    const dedupeKey = lower.slice(0, 80);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    rules.push({
      id: `rule-${rules.length + 1}`,
      text: statement,
      keyword,
    });
  }

  return rules;
}

/** Extract text + heuristic rules from a policy PDF, in the browser. */
export async function parsePolicyPdf(file: File): Promise<PdfParseResult> {
  ensurePromiseWithResolvers();

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const doc = await loadingTask.promise;

  let rawText = "";
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    rawText += `${pageText}\n`;
  }

  const pageCount = doc.numPages;
  // Release the worker and its buffers; the loading task owns teardown in v6.
  await loadingTask.destroy();

  return { rawText, rules: extractRulesFromText(rawText), pageCount };
}
