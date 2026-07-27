"use client";

/**
 * Holds the current analysis in memory for the lifetime of the page session.
 *
 * Deliberately NOT persisted to localStorage, sessionStorage, cookies or a
 * server — a full page reload legitimately clears the analysis. That is the
 * intended behaviour for a prototype that must never retain customer data.
 */

import { createContext, useContext, useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/types";

interface AnalysisContextValue {
  result: AnalysisResult | null;
  setResult: (result: AnalysisResult | null) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | undefined>(
  undefined
);

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const value = useMemo(() => ({ result, setResult }), [result]);
  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) {
    throw new Error("useAnalysis must be used within an AnalysisProvider");
  }
  return ctx;
}
