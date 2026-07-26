import type { ExtractedRule, PdfParseResult } from "./types";

// pdfjs-dist v6 requires Promise.withResolvers, which is undefined on
// browsers older than Safari 17.4 / Chrome 119 / Firefox 121. Polyfill
// defensively before calling into pdfjs-dist so we get a clear failure path
// instead of a bare "undefined is not a function" TypeError.
function ensurePromiseWithResolvers() {
  if (typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers !== "function") {
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
}

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

function splitIntoStatements(text: string): string[] {
  return text
    .split(/(?:\. |; )/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15 && s.length <= 320);
}

function isRuleStatement(statement: string): boolean {
  const lower = statement.toLowerCase();
  return RULE_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function parsePdf(file: File): Promise<PdfParseResult> {
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
    rawText += pageText + " ";
  }

  const statements = splitIntoStatements(rawText);
  const rules: ExtractedRule[] = statements
    .filter(isRuleStatement)
    .slice(0, 25)
    .map((text) => ({ text }));

  return {
    rawText,
    rules,
    pageCount: pdf.numPages,
  };
}
