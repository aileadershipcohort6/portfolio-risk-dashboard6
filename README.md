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
   portfolio CSV (required), or click **Load Sample Data** to populate both
   slots with the bundled sample files.
2. **Run Analysis** parses the CSV, scores every customer, extracts
   keyword-based policy rules from the PDF (if provided), and opens the
   dashboard.
3. **Executive Dashboard** (`/dashboard`) — KPI cards by risk category, total
   portfolio exposure, customers-and-exposure by risk category, exposure by
   industry sector, an illustrative portfolio risk trend, the top 10
   highest-risk customers, recommended actions, and the scoring methodology
   with the policy highlights extracted from the PDF.

## Risk scoring

```
Risk Score = (Credit Risk Weight   × Credit Score Factor)
           + (Repayment Risk Weight × Repayment Status Factor)
           + (Exposure Weight       × Loan Balance Factor)
```

Every factor is normalised to 0–100 (0 = lowest risk, 100 = highest), so the
weighted score is also 0–100.

| Component | Weight | How it is derived |
|---|---|---|
| Credit Score Factor | 40% | `((850 − score) / (850 − 300)) × 100`, clamped to the 300–850 band — a lower score means higher risk. |
| Repayment Status Factor | 40% | Lookup on the status text: Current 0, Watchlist 20, 1–29 days 35, 30 days 55, 60 days 75, 90+ days 90, Non-performing 95, Default/Write-off 100. Unrecognised text scores 50 rather than being ignored. |
| Loan Balance Factor | 20% | `min(balance, $500,000) / $500,000 × 100`. Exposure reflects materiality, not probability of default — hence the lowest weight. |

Categories: **Green** 0–35, **Amber** 36–65, **Red** 66–100.

### Changing the scoring

**Edit `src/lib/riskScoring.ts`** — it is the single file that controls scoring
behaviour. `DEFAULT_WEIGHTS` (must sum to 1), `RISK_THRESHOLDS`
(`greenMax` / `amberMax`), `CREDIT_SCORE_MIN` / `CREDIT_SCORE_MAX`,
`EXPOSURE_CAP` and the repayment status lookup table all live there. The UI
reads these constants directly, so the Upload page explainer and the dashboard
methodology card update automatically.

## CSV format

Expected columns — header names are matched flexibly (case-insensitive, and
`credit_score` / `Credit Score` / `creditscore` all resolve to the same field):

```
CustomerID,CustomerName,Industry,CreditScore,RepaymentStatus,LoanBalance
C001,Acme Manufacturing,Manufacturing,710,Current,1250000
```

If a required column cannot be matched, the error message names the missing
columns. Individual rows with a non-numeric credit score or loan balance, or an
empty customer ID, are skipped and counted rather than failing the whole upload.

## PDF rule extraction

Text is extracted client-side with `pdfjs-dist`, then split into statements and
filtered by lending/risk keywords (credit score, LVR/LTV, DTI, arrears,
delinquency, covenant, concentration limit, provisioning, collateral, and
similar), capped at 25 rules. There are **no LLM or external API calls** — it
is pure keyword heuristics. If a PDF cannot be read (scanned, image-only or
corrupt), the dashboard says so and the portfolio analysis still completes.

## Run locally

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. No environment variables and no
configuration are required.

Other scripts: `npm run build` (production build), `npm run lint`,
`npm run typecheck`.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel: **Add New → Project → Import** the GitHub repository.
3. Accept all defaults (framework is detected as Next.js via `vercel.json`) and
   deploy. There are no environment variables to set.

Subsequent pushes to `main` deploy automatically.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Recharts ·
PapaParse · pdfjs-dist

## Project structure

```
src/
  app/
    layout.tsx            AnalysisProvider + nav + footer
    globals.css           design tokens
    page.tsx              Upload page  (/)
    dashboard/page.tsx    Executive Dashboard  (/dashboard)
  components/             NavBar, UploadPanel, RiskBadge
  context/
    AnalysisContext.tsx   in-memory analysis state
  lib/
    riskScoring.ts        ← edit this to change weights / thresholds
    csvParser.ts          flexible CSV column matching
    pdfParser.ts          client-side PDF text + rule extraction
    aggregations.ts       portfolio roll-ups, trend, recommended actions
    types.ts
public/sample-data/       bundled sample CSV + policy PDF
```

## Deliberately out of scope

No backend, API routes or database. No authentication. No `localStorage` /
`sessionStorage` / cookies — analysis state is in-memory only, so a full page
reload clears it by design. No real customer data anywhere in the repository.
No third-party AI calls for PDF extraction.

## Licence

MIT — see [LICENSE](./LICENSE).
