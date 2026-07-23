"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import UploadPanel from "@/components/UploadPanel";
import { useAnalysis } from "@/context/AnalysisContext";
import { parseCustomerCsv } from "@/lib/csvParser";
import { parsePolicyPdf } from "@/lib/pdfParser";
import { DEFAULT_WEIGHTS, RISK_THRESHOLDS } from "@/lib/riskScoring";

export default function UploadPage() {
  const router = useRouter();
  const { setResult } = useAnalysis();

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isSampleSelected, setIsSampleSelected] = useState(false);

  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePdfSelected(file: File) {
    setPdfFile(file);
    setIsSampleSelected(false);
  }

  function handleCsvSelected(file: File) {
    setCsvFile(file);
    setIsSampleSelected(false);
  }

  async function handleLoadSampleData() {
    setError(null);
    setIsLoadingSample(true);
    try {
      const [csvResponse, pdfResponse] = await Promise.all([
        fetch("/sample-data/sample-customers.csv"),
        fetch("/sample-data/sample-lending-policy.pdf"),
      ]);

      if (!csvResponse.ok) throw new Error("Could not load the sample CSV.");
      if (!pdfResponse.ok) throw new Error("Could not load the sample PDF.");

      const csvBlob = await csvResponse.blob();
      const pdfBlob = await pdfResponse.blob();

      const sampleCsvFile = new File([csvBlob], "sample-customers.csv", {
        type: "text/csv",
      });
      const samplePdfFile = new File([pdfBlob], "sample-lending-policy.pdf", {
        type: "application/pdf",
      });

      setCsvFile(sampleCsvFile);
      setPdfFile(samplePdfFile);
      setIsSampleSelected(true);
    } catch {
      setError("Could not load sample data. Please try again.");
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
      const { customers, rowsSkipped, totalRows } = parseCustomerCsv(
        csvText,
        DEFAULT_WEIGHTS
      );

      if (customers.length === 0) {
        throw new Error(
          `No usable customer rows were found in ${csvFile.name} (${totalRows} row(s) read, ${rowsSkipped} skipped). Check that CustomerID, CreditScore, and LoanBalance are populated.`
        );
      }

      let rules: { text: string }[] = [];
      let pdfPageCount: number | null = null;
      let pdfParseFailed = false;
      let pdfParseError: string | undefined;

      if (pdfFile) {
        try {
          const pdfResult = await parsePolicyPdf(pdfFile);
          rules = pdfResult.rules;
          pdfPageCount = pdfResult.pageCount;
        } catch (pdfErr) {
          pdfParseFailed = true;
          pdfParseError =
            pdfErr instanceof Error ? pdfErr.message : "Unknown PDF parsing error.";
        }
      }

      setResult({
        customers,
        rules,
        weights: DEFAULT_WEIGHTS,
        csvFileName: csvFile.name,
        pdfFileName: pdfFile ? pdfFile.name : null,
        pdfPageCount,
        analysedAt: new Date(),
        isSampleData: isSampleSelected,
        pdfParseFailed,
        pdfParseError,
      });

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while analysing the file.");
    } finally {
      setIsAnalysing(false);
    }
  }

  const creditPct = Math.round(DEFAULT_WEIGHTS.creditRiskWeight * 100);
  const repaymentPct = Math.round(DEFAULT_WEIGHTS.repaymentRiskWeight * 100);
  const exposurePct = Math.round(DEFAULT_WEIGHTS.exposureWeight * 100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Portfolio Risk Analysis</h1>
        <p className="text-[var(--muted)] mt-2 max-w-2xl">
          Upload your lending policy document and customer portfolio to generate an
          executive risk dashboard. All processing happens in your browser — no files
          are sent to a server.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <UploadPanel
          step="1"
          title="Lending Policy & Risk Guidance (PDF)"
          subtitle="Used to surface key policy rules and thresholds referenced on the dashboard. Optional, but recommended."
          accept="application/pdf"
          fileName={pdfFile ? pdfFile.name : null}
          onFileSelected={handlePdfSelected}
          optional
        />
        <UploadPanel
          step="2"
          title="Customer Portfolio (CSV)"
          subtitle="Expected columns: CustomerID, CustomerName, Industry, CreditScore, RepaymentStatus, LoanBalance. Column names are matched flexibly."
          accept=".csv,text/csv"
          fileName={csvFile ? csvFile.name : null}
          onFileSelected={handleCsvSelected}
        />
      </div>

      {error && (
        <div className="rounded-md border border-[var(--risk-red)] bg-[var(--risk-red-bg)] text-[var(--risk-red)] text-sm px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleRunAnalysis}
          disabled={!csvFile || isAnalysing}
          className="px-4 py-2 rounded-md text-sm font-medium bg-[var(--accent)] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--accent-dark)] transition-colors"
        >
          {isAnalysing ? "Analysing…" : "Run Analysis"}
        </button>
        <button
          onClick={handleLoadSampleData}
          disabled={isLoadingSample}
          className="px-4 py-2 rounded-md text-sm font-medium border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--background)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isLoadingSample ? "Loading…" : "Load Sample Data"}
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <h2 className="font-semibold text-sm mb-2">How risk is scored</h2>
        <p className="text-sm text-[var(--muted)] mb-3">
          Risk Score = (Credit Risk Weight &times; Credit Score Factor) + (Repayment
          Risk Weight &times; Repayment Status Factor) + (Exposure Weight &times; Loan
          Balance Factor)
        </p>
        <ul className="text-sm text-[var(--muted)] flex flex-col gap-1">
          <li>
            Credit Risk Weight: <span className="font-medium text-[var(--foreground)]">{creditPct}%</span>
          </li>
          <li>
            Repayment Risk Weight: <span className="font-medium text-[var(--foreground)]">{repaymentPct}%</span>
          </li>
          <li>
            Exposure Weight: <span className="font-medium text-[var(--foreground)]">{exposurePct}%</span>
          </li>
          <li className="mt-1">
            Categories: Green 0–{RISK_THRESHOLDS.greenMax}, Amber {RISK_THRESHOLDS.greenMax + 1}–
            {RISK_THRESHOLDS.amberMax}, Red {RISK_THRESHOLDS.amberMax + 1}–100
          </li>
        </ul>
        <p className="text-xs text-[var(--muted)] mt-3">
          To change these weights or thresholds, edit{" "}
          <code className="px-1.5 py-0.5 rounded bg-[var(--background)] border border-[var(--border)]">
            src/lib/riskScoring.ts
          </code>
          .
        </p>
      </div>
    </div>
  );
}
