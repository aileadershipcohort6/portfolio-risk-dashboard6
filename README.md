# Portfolio Risk Dashboard

A client-side prototype that turns a customer loan portfolio (CSV) and an
optional lending policy document (PDF) into an executive risk dashboard:
Green/Amber/Red customer categorisation, exposure breakdowns, a top-10
highest-risk customer table, and recommended actions.

Everything runs in the browser. There is no backend, no database, no
authentication, and nothing is persisted or uploaded to a server — a full
page reload clears the current analysis by design. This is a prototype for
internal review, not a production risk system, and contains no real
customer data.

## What it does

- **Upload** (`/`) — upload a customer portfolio CSV (required) and a
  lending policy PDF (optional), or click **Load Sample Data** to try it
  with bundled sample files. Click **Run Analysis** to score the portfolio.
- **Executive Dashboard** (`/dashboard`) — customers by risk category, total
  and category-level exposure, a customers/exposure-by-category chart, an
  exposure-by-industry chart, a portfolio risk trend chart, the top 10
  highest-risk customers, recommended actions, and the scoring methodology
  (including any policy rules heuristically extracted from the uploaded PDF).

## Running locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

1. Push this repository to GitHub (already done if you're reading this from
   the deployed repo).
2. In Vercel: **Import Project** → select this GitHub repository → accept
   the default Next.js build settings → **Deploy**. No environment
   variables are required.
3. Vercel will auto-deploy on every push to `main`.

## Changing the risk scoring logic

All scoring weights, thresholds, and the repayment-status lookup table live
in a single file: **`src/lib/riskScoring.ts`**. Edit the constants there
(`DEFAULT_WEIGHTS`, `RISK_THRESHOLDS`, `EXPOSURE_CAP`, etc.) to change how
customers are scored and categorised — the Upload and Dashboard pages read
these constants directly, so nothing else needs to change.

## Tech stack

Next.js (App Router, TypeScript), React, Tailwind CSS, Recharts for charts,
PapaParse for CSV parsing, and pdfjs-dist for client-side PDF text
extraction.

## Out of scope

No authentication, no backend/API routes, no database, no persistence
(localStorage/sessionStorage/cookies), no real customer data, and no
third-party AI/LLM calls — PDF rule extraction uses keyword heuristics only.
