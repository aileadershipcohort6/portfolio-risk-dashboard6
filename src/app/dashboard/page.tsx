"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAnalysis } from "@/context/AnalysisContext";
import RiskBadge from "@/components/RiskBadge";
import WhatIfPanel from "@/components/WhatIfPanel";
import {
  CATEGORY_COLORS,
  EXPOSURE_SERIES_COLOR,
  INDUSTRY_PALETTE,
  categoryChartData,
  categorySummaries,
  exposureByIndustry,
  formatCurrencyCompact,
  formatCurrencyFull,
  generatePortfolioTrend,
  recommendedActions,
  topRiskCustomers,
  totalExposure,
} from "@/lib/aggregations";
import { RISK_THRESHOLDS, scoreCustomer } from "@/lib/riskScoring";
import type { RiskWeights } from "@/lib/types";

export default function DashboardPage() {
  const { result } = useAnalysis();

  // Hooks must run unconditionally, before the "no analysis" early return
  // below, so the what-if weights default to the analysis weights (or the
  // scoring engine defaults if no analysis is loaded yet).
  const [weights, setWeights] = useState<RiskWeights>(
    result?.weights ?? {
      creditRiskWeight: 0.4,
      repaymentRiskWeight: 0.4,
      exposureWeight: 0.2,
    }
  );

  const adjustedCustomers = useMemo(() => {
    if (!result) return [];
    return result.customers.map((c) =>
      scoreCustomer(
        {
          customerId: c.customerId,
          customerName: c.customerName,
          industrySector: c.industrySector,
          creditScore: c.creditScore,
          repaymentStatus: c.repaymentStatus,
          loanBalance: c.loanBalance,
        },
        weights
      )
    );
  }, [result, weights]);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4 py-24">
        <p className="text-lg font-medium">No analysis loaded yet</p>
        <Link
          href="/"
          className="px-4 py-2 rounded-md text-sm font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)] transition-colors"
        >
          Go to Upload
        </Link>
      </div>
    );
  }

  const { customers, rules, csvFileName, pdfFileName, pdfPageCount, analysedAt, isSampleData, pdfParseFailed, pdfParseError } =
    result;

  const summaries = categorySummaries(adjustedCustomers);
  const barData = categoryChartData(adjustedCustomers);
  const industryData = exposureByIndustry(adjustedCustomers);
  const trendData = generatePortfolioTrend(adjustedCustomers);
  const top10 = topRiskCustomers(adjustedCustomers, 10);
  const actions = recommendedActions(adjustedCustomers);
  const total = totalExposure(adjustedCustomers);

  const analysedDate = new Date(analysedAt).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const analysedTime = new Date(analysedAt).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold">Executive Dashboard</h1>
          {isSampleData && (
            <span className="px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide bg-[var(--accent)] text-white">
              Sample Data
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--muted)] mt-2">
          {customers.length} customers &middot; {csvFileName} &middot;{" "}
          {pdfFileName ?? "no policy uploaded"} &middot; analysed {analysedDate}, {analysedTime}
        </p>
      </div>

      <WhatIfPanel weights={weights} onChange={setWeights} />

      {/* 2. Category KPI cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {summaries.map((s) => (
          <div
            key={s.category}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: CATEGORY_COLORS[s.category] }}
              />
              <span className="text-sm font-medium">{s.category}</span>
            </div>
            <div className="text-3xl font-semibold mt-2">{s.count}</div>
            <p className="text-sm text-[var(--muted)] mt-1">
              {s.pctOfCustomers.toFixed(1)}% of customers &middot; {formatCurrencyCompact(s.exposure)}{" "}
              exposure ({s.pctOfExposure.toFixed(1)}%)
            </p>
          </div>
        ))}
      </div>

      {/* 3. Total portfolio exposure */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <p className="text-sm text-[var(--muted)]">Total portfolio exposure</p>
        <p className="text-3xl font-semibold mt-1">{formatCurrencyFull(total)}</p>
      </div>

      {/* 4. Chart row */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="font-semibold text-sm mb-1">Customers &amp; Exposure by Risk Category</h2>
          <CategoryLegend />
          <div className="h-72 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ left: 4, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatCurrencyCompact(v)}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) =>
                    name === "exposure" ? [formatCurrencyFull(Number(value)), "Exposure"] : [value, "Customers"]
                  }
                />
                <Bar yAxisId="left" dataKey="customers" name="customers" radius={[4, 4, 0, 0]}>
                  {barData.map((row) => (
                    <Cell key={row.category} fill={CATEGORY_COLORS[row.category]} />
                  ))}
                </Bar>
                <Bar
                  yAxisId="right"
                  dataKey="exposure"
                  name="exposure"
                  fill={EXPOSURE_SERIES_COLOR}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="font-semibold text-sm mb-1">Exposure by Industry Sector</h2>
          <div className="h-80 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={(value: any) => formatCurrencyFull(Number(value))} />
                <Pie
                  data={industryData}
                  dataKey="exposure"
                  nameKey="industry"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={(entry: any) => entry.name ?? entry.industry}
                  labelLine={false}
                >
                  {industryData.map((row, i) => (
                    <Cell key={row.industry} fill={INDUSTRY_PALETTE[i % INDUSTRY_PALETTE.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Trend chart */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <h2 className="font-semibold text-sm">Portfolio Risk Trend</h2>
        <p className="text-xs text-[var(--muted)] mb-2">Illustrative trend leading up to current position</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ left: 4, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip formatter={(value: any) => [value, "Average Risk Score"]} />
              <Line
                type="monotone"
                dataKey="averageRiskScore"
                name="Average Risk Score"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 6. Top 10 table */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm overflow-x-auto">
        <h2 className="font-semibold text-sm mb-3">Top 10 Highest-Risk Customers</h2>
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[var(--muted)] border-b border-[var(--border)]">
              <th className="py-2 pr-3 font-medium">Customer</th>
              <th className="py-2 pr-3 font-medium">Industry</th>
              <th className="py-2 pr-3 font-medium">Credit Score</th>
              <th className="py-2 pr-3 font-medium">Repayment Status</th>
              <th className="py-2 pr-3 font-medium">Loan Balance</th>
              <th className="py-2 pr-3 font-medium">Risk Score</th>
              <th className="py-2 pr-3 font-medium">Category</th>
            </tr>
          </thead>
          <tbody>
            {top10.map((c) => (
              <tr key={c.customerId} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2 pr-3">{c.customerName}</td>
                <td className="py-2 pr-3">{c.industrySector}</td>
                <td className="py-2 pr-3">{c.creditScore}</td>
                <td className="py-2 pr-3">{c.repaymentStatus}</td>
                <td className="py-2 pr-3">{formatCurrencyFull(c.loanBalance)}</td>
                <td className="py-2 pr-3">{c.riskScore.toFixed(1)}</td>
                <td className="py-2 pr-3">
                  <RiskBadge category={c.category} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 7. Bottom row */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="font-semibold text-sm mb-3">Recommended Actions</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {actions.map((action, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 shrink-0" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="font-semibold text-sm mb-2">Scoring Methodology</h2>
          <p className="text-sm text-[var(--muted)] mb-2">
            Risk Score = (Credit Risk Weight &times; Credit Score Factor) + (Repayment
            Risk Weight &times; Repayment Status Factor) + (Exposure Weight &times; Loan
            Balance Factor)
          </p>
          <p className="text-sm text-[var(--muted)] mb-4">
            Green 0–{RISK_THRESHOLDS.greenMax} &middot; Amber {RISK_THRESHOLDS.greenMax + 1}–
            {RISK_THRESHOLDS.amberMax} &middot; Red {RISK_THRESHOLDS.amberMax + 1}–100
          </p>

          <h3 className="font-semibold text-sm mb-2">Extracted Policy Highlights</h3>
          {!pdfFileName && (
            <p className="text-sm text-[var(--muted)]">
              No policy PDF was uploaded, so no rules were extracted for this analysis.
            </p>
          )}
          {pdfFileName && pdfParseFailed && (
            <p className="text-sm text-[var(--muted)]">
              Could not extract text from {pdfFileName}
              {pdfParseError ? ` (${pdfParseError})` : ""}.
            </p>
          )}
          {pdfFileName && !pdfParseFailed && (
            <>
              <p className="text-xs text-[var(--muted)] mb-2">
                Heuristic extraction from {pdfFileName} — {pdfPageCount ?? 0} page(s) scanned.
              </p>
              {rules.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  No policy rules were detected in this document.
                </p>
              ) : (
                <ul className="max-h-64 overflow-y-auto flex flex-col gap-2 pr-1">
                  {rules.map((rule, i) => (
                    <li
                      key={i}
                      className="text-sm border-l-2 border-[var(--accent)] pl-3 py-0.5"
                    >
                      {rule.text}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
      <span className="font-medium text-[var(--foreground)]">Customers:</span>
      <LegendDot color={CATEGORY_COLORS.Green} label="Green" />
      <LegendDot color={CATEGORY_COLORS.Amber} label="Amber" />
      <LegendDot color={CATEGORY_COLORS.Red} label="Red" />
      <span className="mx-1 text-[var(--border)]">|</span>
      <LegendDot color={EXPOSURE_SERIES_COLOR} label="Exposure" />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
