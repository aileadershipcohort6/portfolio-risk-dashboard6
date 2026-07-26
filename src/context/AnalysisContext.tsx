"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/types";

/**
 * The entire application state lives here, in memory only. There is no
 * localStorage, sessionStorage, cookie or server persistence — a full page
 * reload legitimately clears the current analysis, which is intended behaviour
 * for a prototype that must never retain customer data.
 */
interface AnalysisContextValue {
  result: AnalysisResult | null;
  setResult: (result: AnalysisResult | null) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | undefined>(
  undefined,
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
