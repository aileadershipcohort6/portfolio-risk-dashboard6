"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UploadPanel from "@/components/UploadPanel";
import { useAnalysis } from "@/context/AnalysisContext";
import { parseCsv } from "@/lib/csvParser";
import { parsePdf } from "@/lib/pdfParser";
import { scoreCustomers, DEFAULT_WEIGHTS, RISK_THRESHOLDS } from "@/lib/riskScoring";
import type { AnalysisResult } from "@/lib/types";

export default function UploadPage() {
  const router = useRouter();
  const { setResult } = useAnalysis();

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isSampleSelected, setIsSampleSelected] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePdfSelected(file: File | null) {
    setPdfFile(file);
    setIsSampleSelected(false);
  }

  function handleCsvSelected(file: File | null) {
    setCsvFile(file);
    setIsSampleSelected(false);
  }

  async function handleLoadSampleData() {
    setIsLoadingSample(true);
    setError(null);
    try {
      const [csvResp, pdfResp] = await Promise.all([
        fetch("/sample-data/sample-customers.csv"),
        fetch("/sample-data/sample-lending-policy.pdf"),
      ]);
      const csvBlob = await csvResp.blob();
      const pdfBlob = await pdfResp.blob();
      const csv = new File([csvBlob], "sample-customers.csv", { type: "text/csv" });
      const pdf = new File([pdfBlob], "sample-lending-policy.pdf", { type: "application/pdf" });
      setCsvFile(csv);
      setPdfFile(pdf);
      setIsSampleSelected(true);
    } catch {
      setError("Could not load sample data. Please try again.");
    } finally {
      setIsLoadingSample(false);
    }
  }

  async function handleRunAnalysis() {
    if (!csvFile) return;
    setIsAnalysing(true);
    setError(null);

    try {
      const csvResult = await parseCsv(csvFile);
      const customers = scoreCustomers(csvResult.customers, DEFAULT_WEIGHTS);

      let rules: AnalysisResult["rules"] = [];
      let pdfPageCount: number | null = null;
      let pdfParseFailed = false;

      if (pdfFile) {
        try {
          const pdfResult = await parsePdf(pdfFile);
          rules = pdfResult.rules;
          pdfPageCount = pdfResult.pageCount;
        } catch (pdfErr) {
          console.error("PDF parsing failed:", pdfErr);
          pdfParseFailed = true;
        }
      }

      const result: AnalysisResult = {
        customers,
        rules,
        weights: DEFAULT_WEIGHTS,
        csvFileName: csvFile.name,
        pdfFileName: pdfFile ? pdfFile.name : null,
        pdfPageCount,
        analysedAt: new Date(),
        isSampleData: isSampleSelected,
        pdfParseFailed,
      };

      setResult(result);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while analysing the files.");
    } finally {
      setIsAnalysing(false);
    }
  }

  const weightPct = (w: number) => `${Math.round(w * 100)}%`;

  return (
    <div>
      <h1 className="text-3xl font-semibold">Portfolio Risk Analysis</h1>
      <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--muted)" }}>
        Upload your lending policy document and customer portfolio to generate an executive risk dashboard. All
        processing happens in your browser — no files are sent to a server.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UploadPanel
          inputId="pdf-upload"
          title="1. Lending Policy &amp; Risk Guidance (PDF)"
          subtext="Used to surface key policy rules and thresholds referenced on the dashboard. Optional, but recommended."
          accept="application/pdf"
          required={false}
          selectedFileName={pdfFile?.name ?? null}
          onFileSelected={handlePdfSelected}
        />
        <UploadPanel
          inputId="csv-upload"
          title="2. Customer Portfolio (CSV)"
          subtext="Expected columns: CustomerID, CustomerName, Industry, CreditScore, RepaymentStatus, LoanBalance. Column names are matched flexibly."
          accept=".csv,text/csv"
          required
          selectedFileName={csvFile?.name ?? null}
          onFileSelected={handleCsvSelected}
        />
      </div>

      {error && (
        <div
          className="mt-4 rounded-md border p-3 text-sm"
          style={{ borderColor: "var(--risk-red)", background: "var(--risk-red-bg)", color: "var(--risk-red)" }}
        >
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={handleRunAnalysis}
          disabled={!csvFile || isAnalysing}
          className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {isAnalysing ? "Analysing…" : "Run Analysis"}
        </button>
        <button
          onClick={handleLoadSampleData}
          disabled={isLoadingSample}
          className="rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderColor: "var(--border)" }}
        >
          {isLoadingSample ? "Loading…" : "Load Sample Data"}
        </button>
      </div>

      <div className="mt-8 rounded-xl border bg-[var(--surface)] p-5 shadow-sm sm:p-6" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-sm font-semibold">How risk is scored</h3>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Risk Score = ({weightPct(DEFAULT_WEIGHTS.creditRiskWeight)} × Credit Score Factor) + (
          {weightPct(DEFAULT_WEIGHTS.repaymentRiskWeight)} × Repayment Status Factor) + (
          {weightPct(DEFAULT_WEIGHTS.exposureWeight)} × Loan Balance Factor)
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Categories: Green 0–{RISK_THRESHOLDS.greenMax}, Amber {RISK_THRESHOLDS.greenMax + 1}–
          {RISK_THRESHOLDS.amberMax}, Red {RISK_THRESHOLDS.amberMax + 1}–100.
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          To change weights or thresholds, edit <code className="rounded bg-[var(--background)] px-1 py-0.5">src/lib/riskScoring.ts</code>.
        </p>
      </div>
    </div>
  );
}
