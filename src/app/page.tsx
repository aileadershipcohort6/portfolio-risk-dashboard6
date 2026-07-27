"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UploadPanel from "@/components/UploadPanel";
import { useAnalysis } from "@/context/AnalysisContext";
import { parseCsvFile } from "@/lib/csvParser";
import { parsePdfFile } from "@/lib/pdfParser";
import {
  DEFAULT_WEIGHTS,
  EXPOSURE_CAP,
  RISK_THRESHOLDS,
  scorePortfolio,
} from "@/lib/riskScoring";
import { formatCurrency } from "@/lib/aggregations";
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

  const weightPct = (w: number) => `${Math.round(w * 100)}%`;

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
        new File([csvBlob], "sample-customers.csv", { type: "text/csv" })
      );

      if (pdfRes.ok) {
        const pdfBlob = await pdfRes.blob();
        setPdfFile(
          new File([pdfBlob], "sample-lending-policy.pdf", {
            type: "application/pdf",
          })
        );
      }
      setIsSampleSelected(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load the sample data."
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
      const { customers, rowsSkipped } = await parseCsvFile(csvFile);

      // PDF extraction is optional and best-effort — a failure here must never
      // block the portfolio analysis from completing.
      let rules: ExtractedRule[] = [];
      let pdfPageCount: number | null = null;
      let pdfParseFailed = false;

      if (pdfFile) {
        try {
          const parsed = await parsePdfFile(pdfFile);
          rules = parsed.rules;
          pdfPageCount = parsed.pageCount;
        } catch {
          pdfParseFailed = true;
        }
      }

      setResult({
        customers: scorePortfolio(customers, DEFAULT_WEIGHTS, RISK_THRESHOLDS),
        rules,
        weights: DEFAULT_WEIGHTS,
        csvFileName: csvFile.name,
        pdfFileName: pdfFile?.name ?? null,
        pdfPageCount,
        pdfParseFailed,
        rowsSkipped,
        analysedAt: new Date(),
        isSampleData: isSampleSelected,
      });

      router.push("/dashboard");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong while analysing the portfolio."
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UploadPanel
          step="1"
          title="Lending Policy & Risk Guidance (PDF)"
          description="Used to surface key policy rules and thresholds referenced on the dashboard. Optional, but recommended."
          accept="application/pdf"
          fileName={pdfFile?.name ?? null}
          onFileSelected={(f) => {
            setPdfFile(f);
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
          onFileSelected={(f) => {
            setCsvFile(f);
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
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--background)] disabled:opacity-40"
        >
          {isLoadingSample ? "Loading…" : "Load Sample Data"}
        </button>
        {!csvFile && (
          <span className="text-xs text-[var(--muted)]">
            A portfolio CSV is required to run an analysis.
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--risk-red)] bg-[var(--risk-red-bg)] p-4 text-sm text-[var(--risk-red)]">
          {error}
        </div>
      )}

      {/* How risk is scored — every number below is read from riskScoring.ts */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">How risk is scored</h2>
        <p className="mt-3 rounded-md bg-[var(--background)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--foreground)]">
          Risk Score = (Credit Risk Weight × Credit Score Factor) + (Repayment
          Risk Weight × Repayment Status Factor) + (Exposure Weight × Loan
          Balance Factor)
        </p>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Weights
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li className="flex justify-between gap-4 border-b border-[var(--border)] pb-1.5">
                <span>Credit risk</span>
                <span className="font-medium">
                  {weightPct(DEFAULT_WEIGHTS.creditRiskWeight)}
                </span>
              </li>
              <li className="flex justify-between gap-4 border-b border-[var(--border)] pb-1.5">
                <span>Repayment risk</span>
                <span className="font-medium">
                  {weightPct(DEFAULT_WEIGHTS.repaymentRiskWeight)}
                </span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Exposure</span>
                <span className="font-medium">
                  {weightPct(DEFAULT_WEIGHTS.exposureWeight)}
                </span>
              </li>
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
              Credit score is normalised across the 300–850 bureau range
              (lower score = higher risk). Repayment status maps to a risk
              factor from Current (0) through to Default (100). Exposure is
              measured against a cap of {formatCurrency(EXPOSURE_CAP)}, so size
              signals materiality without dominating the score.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Categories
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-1.5">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--risk-green)]" />
                  Green (Low Risk)
                </span>
                <span className="font-medium">
                  0 – {RISK_THRESHOLDS.greenMax}
                </span>
              </li>
              <li className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-1.5">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--risk-amber)]" />
                  Amber (Medium Risk)
                </span>
                <span className="font-medium">
                  {RISK_THRESHOLDS.greenMax + 1} – {RISK_THRESHOLDS.amberMax}
                </span>
              </li>
              <li className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--risk-red)]" />
                  Red (High Risk)
                </span>
                <span className="font-medium">
                  {RISK_THRESHOLDS.amberMax + 1} – 100
                </span>
              </li>
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
              To change any weight or threshold, edit{" "}
              <code className="rounded bg-[var(--background)] px-1 py-0.5 font-mono text-[11px]">
                src/lib/riskScoring.ts
              </code>{" "}
              — it is the only file that defines scoring behaviour.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
