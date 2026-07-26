"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
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
  CATEGORY_COLOURS,
  CATEGORY_LABELS,
  EXPOSURE_COLOUR,
  INDUSTRY_PALETTE,
  averageRiskScore,
  formatCompactCurrency,
  formatCurrency,
  generatePortfolioTrend,
  recommendedActions,
  summariseByCategory,
  summariseByIndustry,
  thresholdBands,
  topRiskCustomers,
  totalExposure,
} from "@/lib/aggregations";
import { RISK_THRESHOLDS, weightsAsPercent } from "@/lib/riskScoring";

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const { result } = useAnalysis();

  const derived = useMemo(() => {
    if (!result) return null;
    const customers = result.customers;
    return {
      categories: summariseByCategory(customers),
      industries: summariseByIndustry(customers),
      top10: topRiskCustomers(customers, 10),
      trend: generatePortfolioTrend(customers),
      actions: recommendedActions(customers),
      exposure: totalExposure(customers),
      avgScore: averageRiskScore(customers),
    };
  }, [result]);

  if (!result || !derived) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <h1 className="text-xl font-semibold">No analysis loaded yet</h1>
        <p className="mt-2 max-w-md text-sm text-[var(--muted)]">
          Upload a customer portfolio CSV (and optionally a lending policy PDF)
          to generate the executive dashboard.
        </p>
        <Link
          href="/"
          className="mt-5 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-dark)]"
        >
          Go to Upload
        </Link>
      </div>
    );
  }

  const weights = weightsAsPercent(result.weights);
  const categoryChartData = derived.categories.map((c) => ({
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
            <span className="rounded-md bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
              Sample Data
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {result.customers.length} customers · {result.csvFileName} ·{" "}
          {result.pdfFileName ?? "no policy uploaded"} · analysed{" "}
          {result.analysedAt.toLocaleDateString()},{" "}
          {result.analysedAt.toLocaleTimeString()}
          {result.rowsSkipped > 0 && ` · ${result.rowsSkipped} row(s) skipped`}
        </p>
      </div>

      {/* 2. Category KPI cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {derived.categories.map((c) => (
          <Card key={c.category}>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CATEGORY_COLOURS[c.category] }}
              />
              <h2 className="text-sm font-medium">
                {CATEGORY_LABELS[c.category]}
              </h2>
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums">{c.count}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {c.countShare.toFixed(0)}% of customers ·{" "}
              {formatCompactCurrency(c.exposure)} exposure (
              {c.exposureShare.toFixed(0)}%)
            </p>
          </Card>
        ))}
      </div>

      {/* 3. Total portfolio exposure */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Total portfolio exposure
            </h2>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {formatCurrency(derived.exposure)}
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Average risk score
            </h2>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {derived.avgScore}
              <span className="text-base font-normal text-[var(--muted)]">
                /100
              </span>
            </p>
          </div>
        </div>
      </Card>

      {/* 4. Category bar chart + industry pie */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold">
            Customers &amp; Exposure by Risk Category
          </h2>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryChartData}
                margin={{ top: 5, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 12, fill: "var(--muted)" }}
                  stroke="var(--border)"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  stroke="var(--border)"
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  stroke="var(--border)"
                  tickFormatter={(v: number) => formatCompactCurrency(v)}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) =>
                    name === "Exposure"
                      ? [formatCurrency(Number(value)), "Exposure"]
                      : [String(value), "Customers"]
                  }
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                />
                {/* Custom legend: the Customers series has no single flat colour,
                    so recharts' default swatch would show a misleading colour. */}
                <Legend
                  verticalAlign="bottom"
                  height={34}
                  content={() => (
                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-[11px] text-[var(--muted)]">
                      <span className="flex items-center gap-1.5">
                        Customers:
                        {(["Green", "Amber", "Red"] as const).map((cat) => (
                          <span key={cat} className="flex items-center gap-1">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{
                                backgroundColor: CATEGORY_COLOURS[cat],
                              }}
                            />
                            {cat}
                          </span>
                        ))}
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: EXPOSURE_COLOUR }}
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
                  radius={[3, 3, 0, 0]}
                  maxBarSize={44}
                >
                  {categoryChartData.map((entry) => (
                    <Cell
                      key={entry.category}
                      fill={
                        CATEGORY_COLOURS[
                          entry.category as keyof typeof CATEGORY_COLOURS
                        ]
                      }
                    />
                  ))}
                </Bar>
                <Bar
                  yAxisId="right"
                  dataKey="exposure"
                  name="Exposure"
                  fill={EXPOSURE_COLOUR}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={44}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold">Exposure by Industry Sector</h2>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={derived.industries}
                  dataKey="exposure"
                  nameKey="industry"
                  cx="50%"
                  cy="50%"
                  outerRadius="72%"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={(entry: any) => entry.name ?? ""}
                  labelLine={false}
                  stroke="var(--surface)"
                  strokeWidth={1}
                >
                  {derived.industries.map((industry, i) => (
                    <Cell
                      key={industry.industry}
                      fill={INDUSTRY_PALETTE[i % INDUSTRY_PALETTE.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [
                    formatCurrency(Number(value)),
                    String(name),
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
      <Card>
        <h2 className="text-sm font-semibold">Portfolio Risk Trend</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Illustrative trend leading up to current position
        </p>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={derived.trend}
              margin={{ top: 5, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                stroke="var(--border)"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                stroke="var(--border)"
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [String(value), "Average Risk Score"]}
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
                dot={{ r: 2.5, fill: "var(--accent)" }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 6. Top 10 highest-risk customers */}
      <Card className="overflow-hidden">
        <h2 className="text-sm font-semibold">Top 10 Highest-Risk Customers</h2>
        <div className="mt-4 -mx-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
                <th className="px-5 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Industry</th>
                <th className="px-3 py-2 text-right font-medium">
                  Credit Score
                </th>
                <th className="px-3 py-2 font-medium">Repayment Status</th>
                <th className="px-3 py-2 text-right font-medium">
                  Loan Balance
                </th>
                <th className="px-3 py-2 text-right font-medium">Risk Score</th>
                <th className="px-5 py-2 font-medium">Category</th>
              </tr>
            </thead>
            <tbody>
              {derived.top10.map((c) => (
                <tr
                  key={c.customerId}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-5 py-2.5">
                    <div className="font-medium">{c.customerName}</div>
                    <div className="text-[11px] text-[var(--muted)]">
                      {c.customerId}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">
                    {c.industrySector}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {c.creditScore}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">
                    {c.repaymentStatus}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatCurrency(c.loanBalance)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    {c.riskScore}
                  </td>
                  <td className="px-5 py-2.5">
                    <RiskBadge category={c.category} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 7. Recommended actions + scoring methodology */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold">Recommended Actions</h2>
          <ul className="mt-4 space-y-3">
            {derived.actions.map((action, i) => (
              <li key={i} className="flex gap-3 text-xs leading-relaxed">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold">Scoring Methodology</h2>
          <p className="mt-3 rounded-md bg-[var(--background)] p-3 font-mono text-[11px] leading-relaxed">
            Risk Score = ({weights.credit}% × Credit Score Factor) + (
            {weights.repayment}% × Repayment Status Factor) + (
            {weights.exposure}% × Loan Balance Factor)
          </p>
          <ul className="mt-3 space-y-1 text-xs text-[var(--muted)]">
            {thresholdBands().map((band) => (
              <li key={band.label}>
                <span className="font-medium text-[var(--foreground)]">
                  {band.label}
                </span>{" "}
                — score {band.range}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            Thresholds: Green ≤ {RISK_THRESHOLDS.greenMax}, Amber ≤{" "}
            {RISK_THRESHOLDS.amberMax}, Red above.
          </p>

          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Extracted Policy Highlights
            </h3>
            {!result.pdfFileName ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                No policy PDF was uploaded, so no rules were extracted for this
                analysis.
              </p>
            ) : result.pdfParseFailed ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Could not extract text from{" "}
                <span className="font-medium">{result.pdfFileName}</span>. The
                file may be scanned, image-only or unsupported — the portfolio
                analysis above is unaffected.
              </p>
            ) : (
              <>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Heuristic extraction from{" "}
                  <span className="font-medium">{result.pdfFileName}</span> —{" "}
                  {result.pdfPageCount ?? 0} page(s) scanned.
                </p>
                {result.rules.length === 0 ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    No lending or risk rules matched the keyword heuristics in
                    this document.
                  </p>
                ) : (
                  <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {result.rules.map((rule) => (
                      <li
                        key={rule.id}
                        className="border-l-2 border-[var(--accent)] pl-3 text-xs leading-relaxed text-[var(--muted)]"
                      >
                        {rule.text}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
