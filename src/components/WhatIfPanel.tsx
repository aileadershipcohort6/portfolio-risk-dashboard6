"use client";

import type { RiskWeights } from "@/lib/types";
import { DEFAULT_WEIGHTS } from "@/lib/riskScoring";

interface WeightSlider {
  key: keyof RiskWeights;
  label: string;
}

const SLIDERS: WeightSlider[] = [
  { key: "creditRiskWeight", label: "Credit Risk Weight" },
  { key: "repaymentRiskWeight", label: "Repayment Risk Weight" },
  { key: "exposureWeight", label: "Exposure Weight" },
];

interface WhatIfPanelProps {
  weights: RiskWeights;
  onChange: (weights: RiskWeights) => void;
}

const EPSILON = 0.001;

function isDefaultWeights(weights: RiskWeights): boolean {
  return (
    Math.abs(weights.creditRiskWeight - DEFAULT_WEIGHTS.creditRiskWeight) < EPSILON &&
    Math.abs(weights.repaymentRiskWeight - DEFAULT_WEIGHTS.repaymentRiskWeight) < EPSILON &&
    Math.abs(weights.exposureWeight - DEFAULT_WEIGHTS.exposureWeight) < EPSILON
  );
}

export default function WhatIfPanel({ weights, onChange }: WhatIfPanelProps) {
  const atDefault = isDefaultWeights(weights);

  function handleSliderChange(changedKey: keyof RiskWeights, rawPercent: number) {
    const newValue = Math.min(Math.max(rawPercent, 0), 100) / 100;
    const otherKeys = SLIDERS.map((s) => s.key).filter((k) => k !== changedKey);
    const remaining = 1 - newValue;
    const othersCurrentSum = otherKeys.reduce((sum, k) => sum + weights[k], 0);

    const next: RiskWeights = { ...weights, [changedKey]: newValue };

    if (othersCurrentSum <= EPSILON) {
      // Both other sliders are at (or near) zero — split the remainder evenly.
      otherKeys.forEach((k) => {
        next[k] = remaining / otherKeys.length;
      });
    } else {
      // Redistribute the remainder proportionally to the other sliders'
      // current relative shares, so a drag never breaks the 100% total.
      otherKeys.forEach((k) => {
        next[k] = (weights[k] / othersCurrentSum) * remaining;
      });
    }

    onChange(next);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-sm">What-If: Adjust Scoring Weights</h2>
          <p className="text-xs text-[var(--muted)] mt-1">
            Drag to re-weight credit history, repayment behaviour, and exposure.
            Everything below recalculates live — nothing is saved.
          </p>
        </div>
        {!atDefault && (
          <button
            onClick={() => onChange(DEFAULT_WEIGHTS)}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--background)] transition-colors shrink-0"
          >
            Reset to analysis weights
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-5 mt-4">
        {SLIDERS.map(({ key, label }) => {
          const percent = Math.round(weights[key] * 100);
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between mb-1">
                <label htmlFor={key} className="text-xs text-[var(--muted)]">
                  {label}
                </label>
                <span className="text-sm font-semibold">{percent}%</span>
              </div>
              <input
                id={key}
                type="range"
                min={0}
                max={100}
                step={1}
                value={percent}
                onChange={(e) => handleSliderChange(key, Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
