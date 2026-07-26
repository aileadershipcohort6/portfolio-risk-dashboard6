"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import { useAnalysis } from "@/context/AnalysisContext";
import RiskBadge from "@/components/RiskBadge";
import { RISK_THRESHOLDS, DEFAULT_WEIGHTS } from "@/lib/riskScoring";
import {
  categorySummaries,
  totalExposure,
  exposureByIndustry,
  topRiskCustomers,
  generatePortfolioTrend,
  recommendedActions,
} from "@/lib/aggregations";
import type { RiskCategory } from "@/lib/types";

const CATEGORY_COLORS: Record<RiskCategory, string> = {
  Green: "#2f7d4f",
  Amber: "#b5720f",
  Red: "#a3242a",
};

// NAB-inspired red -> grey qualitative palette for the industry pie chart
// (mirrors the brand accent in globals.css rather than the old blue theme).
const INDUSTRY_PALETTE = [
  "#a3001a",
  "#d2001f",
  "#e2495c",
  "#ea7f8c",
  "#f2b6bc",
  "#5c5652",
  "#8b8480",
  "#c2bbb6",
];

function compactCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function fullCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DashboardPage() {
  const { result } = useAnalysis();

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-lg font-medium">No analysis loaded yet</p>
        <Link
          href="/"
          className="rounded-md px-4 py-2 text-sm font-medium text-white"
          style={{ background: "var(--accent)" }}
        >
          Go to Upload
        </Link>
      </div>
    );
  }

  const { customers, rules, csvFileName, pdfFileName, pdfPageCount, analysedAt, isSampleData, pdfParseFailed } =
    result;

  const summaries = categorySummaries(customers);
  const total = totalExposure(customers);
  const industries = exposureByIndustry(customers);
  const top10 = topRiskCustomers(customers, 10);
  const trend = generatePortfolioTrend(customers);
  const actions = recommendedActions(customers);

  const barData = summaries.map((s) => ({
    category: s.category,
    Customers: s.count,
    Exposure: s.exposure,
  }));

  const analysedDate = new Date(analysedAt);

  return (
    <div>
      {/* 1. Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">Executive Dashboard</h1>
        {isSampleData && (
          <span
            className="rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white"
            style={{ background: "var(--accent)" }}
          >
            Sample Data
          </span>
        )}
      </div>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        {customers.length} customers · {csvFileName} · {pdfFileName ?? "no policy uploaded"} · analysed{" "}
        {analysedDate.toLocaleDateString()}, {analysedDate.toLocaleTimeString()}
      </p>

      {/* 2. Category KPI cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaries.map((s) => (
          <div
            key={s.category}
            className="rounded-xl border bg-[var(--surface)] p-5 shadow-sm"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[s.category] }} />
              <span className="text-sm font-medium">{s.category}</span>
            </div>
            <p className="mt-2 text-3xl font-semibold">{s.count}</p>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              {s.pctOfCustomers.toFixed(1)}% of customers · {compactCurrency(s.exposure)} exposure (
              {s.pctOfExposure.toFixed(1)}%)
            </p>
          </div>
        ))}
      </div>

      {/* 3. Total portfolio exposure */}
      <div
        className="mt-4 rounded-xl border bg-[var(--surface)] p-5 shadow-sm sm:p-6"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
          Total Portfolio Exposure
        </p>
        <p className="mt-1 text-3xl font-semibold">{fullCurrency(total)}</p>
      </div>

      {/* 4. Two-column chart row */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-[var(--surface)] p-5 shadow-sm" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold">Customers &amp; Exposure by Risk Category</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => compactCurrency(Number(v))}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) =>
                    name === "Exposure" ? [compactCurrency(Number(value)), name] : [value, name]
                  }
                />
                <Bar yAxisId="left" dataKey="Customers" name="Customers" radius={[4, 4, 0, 0]}>
                  {barData.map((entry) => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category as RiskCategory]} />
                  ))}
                </Bar>
                <Bar yAxisId="right" dataKey="Exposure" name="Exposure" fill="#333a42" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--muted)" }}>
            <span className="font-medium" style={{ color: "var(--foreground)" }}>
              Customers:
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS.Green }} /> Green
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS.Amber }} /> Amber
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS.Red }} /> Red
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: "#333a42" }} /> Exposure
            </span>
          </div>
        </div>

        <div className="rounded-xl border bg-[var(--surface)] p-5 shadow-sm" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold">Exposure by Industry Sector</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={industries}
                  dataKey="exposure"
                  nameKey="industry"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={(entry: any) => entry.name ?? entry.industry}
                >
                  {industries.map((entry, idx) => (
                    <Cell key={entry.industry} fill={INDUSTRY_PALETTE[idx % INDUSTRY_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [compactCurrency(Number(value)), name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Portfolio Risk Trend */}
      <div className="mt-4 rounded-xl border bg-[var(--surface)] p-5 shadow-sm" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-sm font-semibold">Portfolio Risk Trend</h3>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Illustrative trend leading up to current position
        </p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
              <Tooltip />
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
      <div className="mt-4 rounded-xl border bg-[var(--surface)] p-5 shadow-sm" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-sm font-semibold">Top 10 Highest-Risk Customers</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                {["Customer", "Industry", "Credit Score", "Repayment Status", "Loan Balance", "Risk Score", "Category"].map(
                  (h) => (
                    <th key={h} className="py-2 pr-4 font-medium" style={{ color: "var(--muted)" }}>
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {top10.map((c) => (
                <tr key={c.customerId} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="py-2 pr-4">{c.customerName}</td>
                  <td className="py-2 pr-4">{c.industrySector}</td>
                  <td className="py-2 pr-4">{c.creditScore}</td>
                  <td className="py-2 pr-4">{c.repaymentStatus}</td>
                  <td className="py-2 pr-4">{fullCurrency(c.loanBalance)}</td>
                  <td className="py-2 pr-4">{c.riskScore.toFixed(1)}</td>
                  <td className="py-2 pr-4">
                    <RiskBadge category={c.category} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Recommended Actions + Scoring Methodology */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-[var(--surface)] p-5 shadow-sm" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold">Recommended Actions</h3>
          <ul className="mt-3 space-y-2">
            {actions.map((action) => (
              <li key={action} className="flex gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border bg-[var(--surface)] p-5 shadow-sm" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold">Scoring Methodology</h3>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Risk Score = ({Math.round(DEFAULT_WEIGHTS.creditRiskWeight * 100)}% × Credit Score Factor) + (
            {Math.round(DEFAULT_WEIGHTS.repaymentRiskWeight * 100)}% × Repayment Status Factor) + (
            {Math.round(DEFAULT_WEIGHTS.exposureWeight * 100)}% × Loan Balance Factor)
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Green 0–{RISK_THRESHOLDS.greenMax} · Amber {RISK_THRESHOLDS.greenMax + 1}–{RISK_THRESHOLDS.amberMax} · Red{" "}
            {RISK_THRESHOLDS.amberMax + 1}–100
          </p>

          <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            <h4 className="text-sm font-semibold">Extracted Policy Highlights</h4>
            {!pdfFileName && (
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                No policy PDF was uploaded, so no rules were extracted for this analysis.
              </p>
            )}
            {pdfFileName && pdfParseFailed && (
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                Could not extract text from {pdfFileName}.
              </p>
            )}
            {pdfFileName && !pdfParseFailed && (
              <>
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                  Heuristic extraction from {pdfFileName} — {pdfPageCount ?? 0} page(s) scanned.
                </p>
                {rules.length === 0 ? (
                  <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                    No rule-like statements were found in this document.
                  </p>
                ) : (
                  <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {rules.map((rule, idx) => (
                      <p
                        key={idx}
                        className="border-l-2 pl-3 text-sm"
                        style={{ borderColor: "var(--accent)", color: "var(--foreground)" }}
                      >
                        {rule.text}
                      </p>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
