# Portfolio Risk Dashboard

An executive dashboard prototype for lending and credit risk. Upload a lending
policy PDF and a customer portfolio CSV, and the application scores every
customer, classifies them Green / Amber / Red, and presents a portfolio-level
view for executive review.

**Everything runs in the browser.** There is no backend, no database, no
authentication and no external API. Uploaded files are never sent anywhere, and
the analysis is held in memory only — reloading the page clears it by design.

## What it does

**Upload page (`/`)**

- Lending policy PDF (optional) — text is extracted client-side with
  `pdfjs-dist` and scanned with keyword heuristics to surface policy rules
  covering credit score minimums, LVR/DTI limits, arrears handling,
  concentration limits, watchlist and provisioning, and collateral.
- Customer portfolio CSV (required) — expected columns are `CustomerID`,
  `CustomerName`, `Industry`, `CreditScore`, `RepaymentStatus`, `LoanBalance`.
  Column names are matched flexibly against common aliases, so an existing
  extract usually works without renaming. Rows that cannot be scored are
  skipped and counted rather than failing the whole upload.
- **Load Sample Data** populates both file slots with the bundled sample
  portfolio and policy. It does not run the analysis — click **Run Analysis**
  yourself.

**Executive Dashboard (`/dashboard`)**

- Customer count and total exposure by risk category
- Total portfolio exposure
- Customers & exposure by risk category (dual-axis bar chart)
- Exposure by industry sector (pie chart)
- Portfolio risk trend (illustrative line chart ending at the true current average)
- Top 10 highest-risk customers
- Recommended actions
- Scoring methodology and extracted policy highlights

## Risk scoring

```
Risk Score = (Credit Risk Weight    × Credit Score Factor)
           + (Repayment Risk Weight × Repayment Status Factor)
           + (Exposure Weight       × Loan Balance Factor)
```

Each factor is normalised to 0–100 where higher means riskier, so the final
score is also 0–100.

| Factor | Weight | How it is derived |
|---|---|---|
| Credit score | 40% | Inverted across the 300–850 bureau range: 850 → 0, 300 → 100 |
| Repayment status | 40% | Lookup table: Current → 0, Watchlist → 20, 30 days → 55, 60 days → 75, 90+ days → 90, Default → 100. Unrecognised labels default to 50 |
| Exposure | 20% | Loan balance as a share of a $500,000 cap |

Credit history and repayment behaviour are the strongest predictors of default,
so they carry equal and dominant weight. Exposure reflects materiality (how much
is at stake) rather than probability of loss, hence the lower weight — a large,
perfectly performing loan should not be flagged high risk on size alone.

**Categories:** Green 0–35 · Amber 36–65 · Red 66–100.

### Changing thresholds or weights

Edit **`src/lib/riskScoring.ts`** — it is the single file that defines scoring
behaviour. The constants to change are:

- `DEFAULT_WEIGHTS` — relative importance of the three factors (must sum to 1)
- `RISK_THRESHOLDS` — the Green/Amber and Amber/Red boundaries
- `EXPOSURE_CAP` — the loan balance treated as maximum exposure
- `REPAYMENT_STATUS_FACTORS` — the risk factor for each arrears status label

Nothing else in the app hard-codes these numbers; the Upload page explainer and
the dashboard's Scoring Methodology card both read them at runtime.

## Running locally

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. Click **Load Sample Data**, then **Run
Analysis**, to see the dashboard populated with the bundled sample portfolio.

To produce a production build:

```bash
npm run build
npm start
```

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Import Project** and select the repository.
3. Accept the defaults — the framework is detected as Next.js and no
   environment variables are required.

Subsequent pushes to `main` deploy automatically.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Recharts ·
PapaParse · pdfjs-dist

## Project structure

```
src/
  app/
    layout.tsx            App shell — provider, nav, footer
    globals.css           Design tokens
    page.tsx              Upload page (/)
    dashboard/page.tsx    Executive Dashboard (/dashboard)
  components/
    NavBar.tsx
    UploadPanel.tsx
    RiskBadge.tsx
  context/
    AnalysisContext.tsx   In-memory analysis state
  lib/
    types.ts
    riskScoring.ts        ← edit this file to change scoring
    csvParser.ts
    pdfParser.ts
    aggregations.ts
public/
  sample-data/            Sample portfolio CSV and lending policy PDF
```

## Out of scope

No backend, API routes, database or server-side persistence. No authentication.
No browser storage of analysis data. No real customer data anywhere in this
repository — the bundled sample portfolio is fictional. PDF rule extraction uses
keyword heuristics only, with no third-party AI or LLM calls.

## Licence

MIT — see [LICENSE](LICENSE).
