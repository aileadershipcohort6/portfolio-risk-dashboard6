# Portfolio Risk Dashboard

A client-side prototype that turns a customer portfolio CSV and a lending
policy PDF into an executive risk dashboard — customer risk scoring,
Green/Amber/Red categorisation, exposure breakdowns, a top-10 highest-risk
table, and recommended actions.

All processing happens in the browser. There is no backend, no database, no
authentication, and nothing is uploaded to a server — this is a prototype for
internal review only, and it must never be given real customer data.

## What it does

1. **Upload** (`/`) — upload a lending policy PDF (optional) and a customer
   portfolio CSV (required), or click **Load Sample Data** to try it with the
   bundled sample files.
2. **Run Analysis** parses the CSV, scores every customer, extracts
   keyword-based policy rules from the PDF (if provided), and navigates to the
   dashboard.
3. **Executive Dashboard** (`/dashboard`) — KPI cards by risk category, total
   exposure, a customers/exposure-by-category chart, an exposure-by-industry
   pie chart, a portfolio risk trend chart, a top-10 highest-risk customers
   table, recommended actions, and the scoring methodology with any extracted
   policy highlights.

## Risk scoring

```
Risk Score = (Credit Risk Weight × Credit Score Factor)
           + (Repayment Risk Weight × Repayment Status Factor)
           + (Exposure Weight × Loan Balance Factor)
```

Default weights: Credit Risk 40%, Repayment Risk 40%, Exposure 20%.
Categories: Green 0–35, Amber 36–65, Red 66–100.

**To change scoring weights or thresholds, edit `src/lib/riskScoring.ts`** —
it is the single file that controls scoring behaviour across the whole app.

## Running locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

1. Push this repository to GitHub (already done if you're reading this from
   the deployed repo).
2. In Vercel: **Import Project** → select this GitHub repository → accept the
   defaults (framework auto-detects as Next.js via `vercel.json`) → **Deploy**.
3. No environment variables are required — the app is entirely client-side.

## Expected CSV columns

`CustomerID, CustomerName, Industry, CreditScore, RepaymentStatus, LoanBalance`
— column names are matched flexibly (case-insensitive, common aliases
accepted).

## Tech stack

Next.js (App Router, TypeScript), Tailwind CSS, Recharts, PapaParse,
pdfjs-dist. No backend, no external APIs.

## Out of scope

No authentication, no server-side persistence, no real customer data, no
localStorage/sessionStorage — analysis state lives in memory only and is lost
on a full page reload by design.
