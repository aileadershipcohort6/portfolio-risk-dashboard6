"use client";

import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import type { AnalysisResult } from "@/lib/types";

interface AnalysisContextValue {
  result: AnalysisResult | null;
  setResult: (result: AnalysisResult | null) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | undefined>(undefined);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const value = useMemo(() => ({ result, setResult }), [result]);

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) {
    throw new Error("useAnalysis must be used within an AnalysisProvider");
  }
  return ctx;
}
