"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import RiskBadge from "@/components/RiskBadge";
import { useAnalysis } from "@/context/AnalysisContext";
import {
  CATEGORY_HEX,
  CATEGORY_LABEL,
  INDUSTRY_PALETTE,
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
  generatePortfolioTrend,
  recommendedActions,
  summariseByCategory,
  summariseByIndustry,
  topRiskCustomers,
  totalExposure,
} from "@/lib/aggregations";
import { DEFAULT_WEIGHTS, RISK_THRESHOLDS } from "@/lib/riskScoring";

const EXPOSURE_SERIES_COLOR = "#333a42";

function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm ${className}`}
    >
      {title && <h2 className="text-base font-semibold">{title}</h2>}
      {subtitle && (
        <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>
      )}
      <div className={title ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export default function DashboardPage() {
  const { result } = useAnalysis();

  const data = useMemo(() => {
    if (!result) return null;
    const customers = result.customers;
    return {
      categories: summariseByCategory(customers),
      industries: summariseByIndustry(customers),
      top10: topRiskCustomers(customers, 10),
      trend: generatePortfolioTrend(customers),
      actions: recommendedActions(customers),
      total: totalExposure(customers),
    };
  }, [result]);

  if (!result || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-xl font-semibold">No analysis loaded yet</h1>
        <p className="max-w-md text-sm text-[var(--muted)]">
          Upload a customer portfolio CSV (and optionally a lending policy PDF)
          to generate the executive dashboard.
        </p>
        <Link
          href="/"
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-dark)]"
        >
          Go to Upload
        </Link>
      </div>
    );
  }

  const categoryChartData = data.categories.map((c) => ({
    category: c.category,
    customers: c.count,
    exposure: c.exposure,
  }));

  return (
    <div className="space-y-5">
      {/* 1. Header */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            Executive Dashboard
          </h1>
          {result.isSampleData && (
            <span className="rounded-md bg-[var(--accent)] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
              Sample Data
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {result.customers.length} customers · {result.csvFileName} ·{" "}
          {result.pdfFileName ?? "no policy uploaded"} · analysed{" "}
          {result.analysedAt.toLocaleDateString("en-AU", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          ,{" "}
          {result.analysedAt.toLocaleTimeString("en-AU", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {result.rowsSkipped > 0 && ` · ${result.rowsSkipped} row(s) skipped`}
        </p>
      </div>

      {/* 2. Category KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {data.categories.map((c) => (
          <div
            key={c.category}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CATEGORY_HEX[c.category] }}
                aria-hidden="true"
              />
              <span className="text-sm font-medium">
                {CATEGORY_LABEL[c.category]}
              </span>
            </div>
            <div className="mt-3 text-3xl font-semibold tabular-nums">
              {c.count}
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {formatPercent(c.countShare)} of customers ·{" "}
              {formatCompactCurrency(c.exposure)} exposure (
              {formatPercent(c.exposureShare)})
            </p>
          </div>
        ))}
      </div>

      {/* 3. Total portfolio exposure */}
      <Card>
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Total portfolio exposure
        </div>
        <div className="mt-2 text-3xl font-semibold tabular-nums">
          {formatCurrency(data.total)}
        </div>
      </Card>

      {/* 4. Category bar chart + industry pie chart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Customers & Exposure by Risk Category">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryChartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 12, fill: "var(--muted)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatCompactCurrency(v)}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) =>
                    name === "Exposure"
                      ? [formatCurrency(Number(value)), "Exposure"]
                      : [value, "Customers"]
                  }
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                />
                {/* Custom legend: the Customers series has no single flat
                    colour, so recharts' default swatch would be misleading. */}
                <Legend
                  content={() => (
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
                      <span className="flex items-center gap-1.5">
                        Customers:
                        {(["Green", "Amber", "Red"] as const).map((c) => (
                          <span key={c} className="flex items-center gap-1">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: CATEGORY_HEX[c] }}
                            />
                            {c}
                          </span>
                        ))}
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: EXPOSURE_SERIES_COLOR }}
                        />
                        Exposure
                      </span>
                    </div>
                  )}
                />
                <Bar
                  yAxisId="left"
                  dataKey="customers"
                  name="Customers"
                  radius={[4, 4, 0, 0]}
                >
                  {categoryChartData.map((entry) => (
                    <Cell
                      key={entry.category}
                      fill={
                        CATEGORY_HEX[
                          entry.category as keyof typeof CATEGORY_HEX
                        ]
                      }
                    />
                  ))}
                </Bar>
                <Bar
                  yAxisId="right"
                  dataKey="exposure"
                  name="Exposure"
                  fill={EXPOSURE_SERIES_COLOR}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Exposure by Industry Sector">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.industries}
                  dataKey="exposure"
                  nameKey="industry"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={(entry: any) => entry.name}
                  labelLine={false}
                  fontSize={10}
                >
                  {data.industries.map((entry, i) => (
                    <Cell
                      key={entry.industry}
                      fill={INDUSTRY_PALETTE[i % INDUSTRY_PALETTE.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [
                    formatCurrency(Number(value)),
                    name,
                  ]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* 5. Portfolio risk trend */}
      <Card
        title="Portfolio Risk Trend"
        subtitle="Illustrative trend leading up to current position"
      >
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data.trend}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [value, "Average Risk Score"]}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="averageRiskScore"
                name="Average Risk Score"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ r: 2.5 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 6. Top 10 highest-risk customers */}
      <Card title="Top 10 Highest-Risk Customers">
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="pb-2 pr-3 font-semibold">Customer</th>
                <th className="pb-2 pr-3 font-semibold">Industry</th>
                <th className="pb-2 pr-3 text-right font-semibold">
                  Credit Score
                </th>
                <th className="pb-2 pr-3 font-semibold">Repayment Status</th>
                <th className="pb-2 pr-3 text-right font-semibold">
                  Loan Balance
                </th>
                <th className="pb-2 pr-3 text-right font-semibold">
                  Risk Score
                </th>
                <th className="pb-2 font-semibold">Category</th>
              </tr>
            </thead>
            <tbody>
              {data.top10.map((c) => (
                <tr
                  key={c.customerId}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="py-2.5 pr-3">
                    <div className="font-medium">{c.customerName}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {c.customerId}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-[var(--muted)]">
                    {c.industrySector}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {c.creditScore}
                  </td>
                  <td className="py-2.5 pr-3 text-[var(--muted)]">
                    {c.repaymentStatus}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {formatCurrency(c.loanBalance)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                    {c.riskScore}
                  </td>
                  <td className="py-2.5">
                    <RiskBadge category={c.category} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 7. Recommended actions + scoring methodology */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Recommended Actions">
          <ul className="space-y-3">
            {data.actions.map((action, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                  aria-hidden="true"
                />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Scoring Methodology">
          <p className="rounded-md bg-[var(--background)] px-3 py-2 font-mono text-[11px] leading-relaxed">
            Risk Score = ({Math.round(DEFAULT_WEIGHTS.creditRiskWeight * 100)}%
            × Credit Score Factor) + (
            {Math.round(DEFAULT_WEIGHTS.repaymentRiskWeight * 100)}% × Repayment
            Status Factor) + ({Math.round(DEFAULT_WEIGHTS.exposureWeight * 100)}
            % × Loan Balance Factor)
          </p>
          <ul className="mt-3 space-y-1 text-xs text-[var(--muted)]">
            <li>
              <span className="font-medium text-[var(--risk-green)]">
                Green
              </span>{" "}
              0–{RISK_THRESHOLDS.greenMax} ·{" "}
              <span className="font-medium text-[var(--risk-amber)]">
                Amber
              </span>{" "}
              {RISK_THRESHOLDS.greenMax + 1}–{RISK_THRESHOLDS.amberMax} ·{" "}
              <span className="font-medium text-[var(--risk-red)]">Red</span>{" "}
              {RISK_THRESHOLDS.amberMax + 1}–100
            </li>
          </ul>

          <h3 className="mt-5 text-sm font-semibold">
            Extracted Policy Highlights
          </h3>
          {result.pdfFileName ? (
            result.pdfParseFailed ? (
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                Could not extract text from{" "}
                <span className="font-medium">{result.pdfFileName}</span>. The
                file may be scanned, image-only or protected — the portfolio
                analysis above is unaffected.
              </p>
            ) : (
              <>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Heuristic extraction from {result.pdfFileName} —{" "}
                  {result.pdfPageCount ?? 0} page(s) scanned.
                </p>
                {result.rules.length > 0 ? (
                  <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {result.rules.map((rule) => (
                      <li
                        key={rule.id}
                        className="border-l-2 border-[var(--accent)] pl-3 text-xs leading-relaxed"
                      >
                        {rule.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    No lending or risk rules were matched in this document.
                  </p>
                )}
              </>
            )
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              No policy PDF was uploaded, so no rules were extracted for this
              analysis.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
