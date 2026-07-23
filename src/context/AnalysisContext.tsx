"use client";

// Single client-side React Context holding the current analysis result.
// No persistence of any kind — a full page reload legitimately loses the
// current analysis. That's intentional prototype behaviour, not a bug.

import { createContext, useContext, useState, ReactNode } from "react";
import type { AnalysisResult } from "@/lib/types";

interface AnalysisContextValue {
  result: AnalysisResult | null;
  setResult: (result: AnalysisResult | null) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | undefined>(undefined);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<AnalysisResult | null>(null);

  return (
    <AnalysisContext.Provider value={{ result, setResult }}>
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
