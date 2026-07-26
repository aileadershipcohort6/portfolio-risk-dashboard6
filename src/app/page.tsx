"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UploadPanel from "@/components/UploadPanel";
import { useAnalysis } from "@/context/AnalysisContext";
import { parsePortfolioCsv } from "@/lib/csvParser";
import { parsePolicyPdf } from "@/lib/pdfParser";
import {
  CREDIT_SCORE_MAX,
  CREDIT_SCORE_MIN,
  DEFAULT_WEIGHTS,
  EXPOSURE_CAP,
  RISK_THRESHOLDS,
  scoreCustomers,
  weightsAsPercent,
} from "@/lib/riskScoring";
import { formatCompactCurrency, thresholdBands } from "@/lib/aggregations";
import type { ExtractedRule } from "@/lib/types";

export default function UploadPage() {
  const router = useRouter();
  const { setResult } = useAnalysis();

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isSampleSelected, setIsSampleSelected] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weights = weightsAsPercent(DEFAULT_WEIGHTS);

  /**
   * Load Sample Data only *populates* the two file slots — it deliberately does
   * not run the analysis or navigate. Running the analysis stays an explicit,
   * separate click, and the sample files go through the exact same CSV/PDF
   * parsing path as a manual upload.
   */
  async function handleLoadSample() {
    setError(null);
    setIsLoadingSample(true);
    try {
      const [csvRes, pdfRes] = await Promise.all([
        fetch("/sample-data/sample-customers.csv"),
        fetch("/sample-data/sample-lending-policy.pdf"),
      ]);
      if (!csvRes.ok) throw new Error("Could not load the sample CSV.");

      const csvBlob = await csvRes.blob();
      setCsvFile(
        new File([csvBlob], "sample-customers.csv", { type: "text/csv" }),
      );

      if (pdfRes.ok) {
        const pdfBlob = await pdfRes.blob();
        setPdfFile(
          new File([pdfBlob], "sample-lending-policy.pdf", {
            type: "application/pdf",
          }),
        );
      }
      setIsSampleSelected(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load the sample data.",
      );
    } finally {
      setIsLoadingSample(false);
    }
  }

  async function handleRunAnalysis() {
    if (!csvFile) return;
    setError(null);
    setIsAnalysing(true);

    try {
      const csvText = await csvFile.text();
      const parsed = parsePortfolioCsv(csvText);
      const scored = scoreCustomers(parsed.customers, DEFAULT_WEIGHTS);

      // PDF extraction is best-effort: a scanned, corrupt or unsupported PDF
      // must never block the CSV analysis from completing.
      let rules: ExtractedRule[] = [];
      let pdfPageCount: number | null = null;
      let pdfParseFailed = false;

      if (pdfFile) {
        try {
          const pdfResult = await parsePolicyPdf(pdfFile);
          rules = pdfResult.rules;
          pdfPageCount = pdfResult.pageCount;
        } catch {
          pdfParseFailed = true;
        }
      }

      setResult({
        customers: scored,
        rules,
        weights: DEFAULT_WEIGHTS,
        csvFileName: csvFile.name,
        pdfFileName: pdfFile?.name ?? null,
        pdfPageCount,
        pdfParseFailed,
        rowsSkipped: parsed.rowsSkipped,
        analysedAt: new Date(),
        isSampleData: isSampleSelected,
      });

      router.push("/dashboard");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong while analysing the portfolio.",
      );
    } finally {
      setIsAnalysing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Portfolio Risk Analysis
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          Upload your lending policy document and customer portfolio to generate
          an executive risk dashboard. All processing happens in your browser —
          no files are sent to a server.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <UploadPanel
          step="1"
          title="Lending Policy & Risk Guidance (PDF)"
          description="Used to surface key policy rules and thresholds referenced on the dashboard. Optional, but recommended."
          accept="application/pdf"
          fileName={pdfFile?.name ?? null}
          onSelect={(file) => {
            setPdfFile(file);
            setIsSampleSelected(false);
            setError(null);
          }}
        />
        <UploadPanel
          step="2"
          title="Customer Portfolio (CSV)"
          description="Expected columns: CustomerID, CustomerName, Industry, CreditScore, RepaymentStatus, LoanBalance. Column names are matched flexibly."
          accept=".csv,text/csv"
          fileName={csvFile?.name ?? null}
          required
          onSelect={(file) => {
            setCsvFile(file);
            setIsSampleSelected(false);
            setError(null);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleRunAnalysis}
          disabled={!csvFile || isAnalysing}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isAnalysing ? "Analysing…" : "Run Analysis"}
        </button>
        <button
          type="button"
          onClick={handleLoadSample}
          disabled={isLoadingSample}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--background)] disabled:opacity-50"
        >
          {isLoadingSample ? "Loading…" : "Load Sample Data"}
        </button>
        {!csvFile && (
          <span className="text-xs text-[var(--muted)]">
            A portfolio CSV is required to run the analysis.
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--risk-red)] bg-[var(--risk-red-bg)] p-4 text-sm text-[var(--risk-red)]">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h2 className="text-sm font-semibold">How risk is scored</h2>
        <p className="mt-3 rounded-md bg-[var(--background)] p-3 font-mono text-xs leading-relaxed text-[var(--foreground)]">
          Risk Score = ({weights.credit}% × Credit Score Factor) + (
          {weights.repayment}% × Repayment Status Factor) + ({weights.exposure}%
          × Loan Balance Factor)
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Credit Score Factor · {weights.credit}%
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              Scaled across a {CREDIT_SCORE_MIN}–{CREDIT_SCORE_MAX} band and
              inverted, so a lower credit score produces a higher risk
              contribution.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Repayment Status Factor · {weights.repayment}%
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              Current = 0, watchlist = 20, 30 days late = 55, 60 days = 75, 90+
              days = 90, default / write-off = 100. Unrecognised statuses score
              50 rather than being ignored.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Loan Balance Factor · {weights.exposure}%
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              Linear up to a {formatCompactCurrency(EXPOSURE_CAP)} cap. Exposure
              reflects materiality, not probability of default — hence the
              lowest weight.
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Risk categories
          </h3>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--muted)]">
            {thresholdBands().map((band) => (
              <li key={band.label}>
                <span className="font-medium text-[var(--foreground)]">
                  {band.label}
                </span>{" "}
                — score {band.range}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-[var(--muted)]">
            Weights and thresholds are defined in{" "}
            <code className="rounded bg-[var(--background)] px-1.5 py-0.5 font-mono text-[11px]">
              src/lib/riskScoring.ts
            </code>{" "}
            — edit that one file to change scoring behaviour. Current thresholds:
            Green ≤ {RISK_THRESHOLDS.greenMax}, Amber ≤{" "}
            {RISK_THRESHOLDS.amberMax}.
          </p>
        </div>
      </section>
    </div>
  );
}
