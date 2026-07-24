# Portfolio Risk Dashboard — Design & Build Specification

**Purpose of this document:** this is the authoritative, deterministic spec for the
Portfolio Risk Dashboard prototype. When the starter prompt is run fresh on any
machine, the output must match this document exactly — same pages, same copy,
same colours, same chart types, same scoring logic, same file structure. Treat
every value in this document as a hard requirement, not a suggestion. Where the
original starter prompt leaves a decision open ("use your judgement"), the
decision has already been made below — do not re-derive it.

This file is a companion to `CLAUDE.md` (which covers process/workflow rules)
and should be read in full before writing any code.

---

## 1. Tech stack (pinned)

| Package | Version | Notes |
|---|---|---|
| next | **15.5.20** (exact, not `^` or `latest`) | Next.js 16.x + Turbopack was tested and produces a Vercel deployment that builds "successfully" but serves a platform-level 404 on every route. Do not use Next 16 until this is independently re-verified. |
| react / react-dom | 19.2.4 | |
| typescript | ^5 | |
| tailwindcss | ^4 (with `@tailwindcss/postcss`) | |
| recharts | ^3.9.2 | charting — see §9 for TypeScript typing gotchas with Tooltip/Pie |
| papaparse | ^5.5.4 (+ `@types/papaparse`) | CSV parsing |
| pdfjs-dist | ^6.1.200 | client-side PDF text extraction |
| eslint / eslint-config-next | ^9 / 15.5.20 | flat config via `FlatCompat` — see §9 |

Scaffold with: `create-next-app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`

Do **not** use `next/font/google` (Geist, etc.) — font loading fails in sandboxed
build environments with no outbound network access to Google Fonts. Use the
system font stack instead (see §3).

## 2. Repo & deployment target

- GitHub repo: `https://github.com/ai-leadership-cohort-1/portfolio-risk-dashboard2`
  (or whatever repo URL is given in `config.txt` at build time — always read that
  file for the actual target, this is documentation of what was used previously).
- Vercel project auto-deploys from the `main` branch via GitHub integration —
  do not use `vercel deploy` CLI/MCP tooling to push a separate deployment; a
  `git push` to `main` is sufficient and is the single source of truth.
- Add a `vercel.json` with `{ "framework": "nextjs" }` to make the framework
  detection explicit.
- Local builds must be run **outside** any FUSE-mounted/synced directory (e.g.
  copy the project to a scratch path like `~/build/` before running
  `npm run build`) — building directly on a mounted output folder can crash
  with a bus error in some sandboxes.

## 3. Design tokens (exact values — do not approximate)

Calm, restrained banking aesthetic. One accent colour (mid-blue). Green/Amber/Red
are used **only** as semantic risk-category colours, never decoratively.

```css
--background: #f6f7f9;
--surface: #ffffff;
--foreground: #1a2027;
--muted: #5b6572;
--border: #e2e5e9;
--accent: #2c5a8c;
--accent-dark: #1f4267;
--risk-green: #2f7d4f;
--risk-green-bg: #eaf5ee;
--risk-amber: #b5720f;
--risk-amber-bg: #fdf3e2;
--risk-red: #b13030;
--risk-red-bg: #fbeaea;
```

Font: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
(no Google Fonts, no custom webfont).

Chart colour usage:
- Risk category series (bars, dots, badges): Green `#2f7d4f`, Amber `#b5720f`, Red `#b13030`.
- "Exposure" bar series (second series alongside a category-coloured "Customers"
  series): flat neutral dark `#333a42` — never risk-coloured.
- Industry pie chart: a blue→grey qualitative palette, cycled in this exact order:
  `#1f4267, #2c5a8c, #4a7ab0, #7098c2, #9db8d6, #5b6572, #8b95a1, #b8c0c9`.
- Trend line: `var(--accent)`.

No emoji, no gradients, no illustrations, no stock imagery. Rounded corners
(`rounded-xl` on cards, `rounded-md` on buttons/pills), `shadow-sm` on cards,
generous padding (`p-5`/`p-6`), border colour `var(--border)` throughout.

## 4. App structure

Two routes only. **Do not add a third "Board Summary" page or route** — this
was built once and explicitly removed; do not re-add it unless separately
instructed.

```
/            Upload page (Home)
/dashboard   Executive Dashboard
```

File tree (everything under `src/`):

```
src/
  app/
    layout.tsx          — wraps children in AnalysisProvider + NavBar + footer
    globals.css          — design tokens (§3)
    page.tsx              — Upload page logic (route "/")
    dashboard/page.tsx    — Executive Dashboard page logic (route "/dashboard")
  components/
    NavBar.tsx
    UploadPanel.tsx
    RiskBadge.tsx
  context/
    AnalysisContext.tsx   — React Context holding the current AnalysisResult
  lib/
    types.ts
    riskScoring.ts         — THE file to edit for weights/thresholds (§6)
    csvParser.ts
    pdfParser.ts
    aggregations.ts
public/
  sample-data/
    sample-customers.csv
    sample-lending-policy.pdf
```

No backend, no API routes, no database, no authentication, no server-side
persistence anywhere in this tree. All state lives in a single client-side
React Context (`AnalysisContext`) that is populated when the user runs an
analysis and is lost on full page reload — this is intentional (see
out-of-scope guardrails).

## 5. Shared state contract (`AnalysisContext`)

```ts
interface AnalysisResult {
  customers: ScoredCustomer[];
  rules: ExtractedRule[];
  weights: RiskWeights;
  csvFileName: string;
  pdfFileName: string | null;
  pdfPageCount: number | null;
  analysedAt: Date;
  isSampleData: boolean;
}
```

`AnalysisProvider` wraps the whole app in `layout.tsx`. `useAnalysis()` exposes
`{ result, setResult }`. When `result` is `null`, `/dashboard` must render an
empty state with a "Go to Upload" link back to `/` — never crash or show blank
charts.

## 6. Risk scoring engine (`src/lib/riskScoring.ts`)

This file's header comment must say it is **the single file to edit** to
change scoring behaviour. Exact formula, weights, and thresholds:

```
Risk Score = (Credit Risk Weight × Credit Score Factor)
           + (Repayment Risk Weight × Repayment Status Factor)
           + (Exposure Weight × Loan Balance Factor)
```

- `DEFAULT_WEIGHTS`: creditRiskWeight `0.4`, repaymentRiskWeight `0.4`, exposureWeight `0.2` (must sum to 1).
  Rationale (keep as a code comment): credit history and repayment behaviour are
  the strongest predictors of default; exposure reflects materiality, not
  probability, hence the lower weight.
- `CREDIT_SCORE_MIN`/`MAX`: 300 / 850. Credit Score Factor = `((850 − score) / (850 − 300)) × 100`, clamped to the band first.
- `EXPOSURE_CAP`: `$500,000`. Exposure Factor = `min(loanBalance, cap) / cap × 100`.
- Repayment Status Factor: free-text lookup table (Current/On Time → 0,
  Watchlist/Grace → 20, 1–29 days → 35, 30 days → 55, 60 days → 75 (60–89 label uses 75, single "60 Days Past Due" label uses 60 — keep both entries as-is, this asymmetry is intentional history, not a bug to "fix"), 90+ days → 90, Default/Write-off → 100, Non-performing/NPL → 95); unrecognised text with no
  parseable day count defaults to `50` (moderate risk, never silently ignored).
- `RISK_THRESHOLDS`: `greenMax: 35`, `amberMax: 65` → Green 0–35, Amber 36–65, Red 66–100.

All three factors are computed independently and exposed on the scored
customer object (`creditScoreFactor`, `repaymentRiskFactor`, `exposureFactor`,
`riskScore`, `category`) — the UI must be able to show the breakdown, not just
the final number.

## 7. CSV parsing (`src/lib/csvParser.ts`)

Required logical columns and their accepted header aliases (case-insensitive,
whitespace-normalised):

- `customerId` ← customer_id, customerid, id, account_id, account number, customer id
- `customerName` ← customer_name, customername, name, client name, customer
- `industrySector` ← industry_sector, industry, sector, industry sector
- `creditScore` ← credit_score, creditscore, credit score, score, bureau_score
- `repaymentStatus` ← repayment_status, repaymentstatus, repayment status, status, arrears_status, delinquency_status
- `loanBalance` ← loan_balance, loanbalance, loan balance, balance, exposure, outstanding_balance

If any required column can't be matched, surface the missing columns by name
in the error message and do not silently proceed. Rows with an unparseable
credit score, unparseable loan balance, or empty customer ID are skipped and
counted in `rowsSkipped`, not fatal to the whole upload.

## 8. PDF rule extraction (`src/lib/pdfParser.ts`)

Client-side only, via `pdfjs-dist` with the worker loaded as a bundled asset
(`new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`) — never a
CDN URL, this must work fully offline. No LLM/API calls of any kind for rule
extraction; it is pure keyword + sentence-splitting heuristics:

- Split extracted text into statements on `. ` / `; ` boundaries, keep those
  15–320 characters long.
- Flag a statement as a "rule" if it contains any of: credit score,
  debt-to-income / debt to income / dti, loan-to-value / loan to value / ltv,
  delinquen*, default, past due, arrears, watchlist, covenant, exposure limit,
  concentration limit, threshold, risk rating, risk grade, write-off/write off,
  provisioning, collateral, minimum, maximum.
- Cap output at 25 rules. Also return the PDF's page count alongside the rules
  (`{ rawText, rules, pageCount }`) so the UI can show "N page(s) scanned".

## 9. ESLint & TypeScript build gotchas

`eslint-config-next@15.x` ships in the legacy `extends`-style format, not a
flat-config array. The `eslint.config.mjs` generated by `create-next-app` for
Next 16 (`import nextVitals from "eslint-config-next/core-web-vitals"` used
directly in a flat array) will throw `nextVitals is not iterable` against
Next 15's version of the package. Use `FlatCompat` instead:

```js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**"] },
];
```

Add `@eslint/eslintrc` as an exact-pinned devDependency. Without the explicit
`ignores` block, ESLint will lint the generated `.next/types/**` files and
produce thousands of false-positive errors.

### Recharts v3 Tooltip/Pie typing

`recharts@3.x`'s `Formatter` type for `<Tooltip formatter={...}>` types
`value` as `ValueType | undefined`, not `number`/`string`, so a formatter
typed as `(value: number, name: string) => ...` fails `tsc --noEmit` with a
"Types of parameters ... are incompatible" error. Likewise `<Pie
label={...}>`'s render props have no `.industry`-style field for a custom
`nameKey` — only `name`/`value`/etc. Fix both by loosely typing the callback
params (`value: any, name: any` with an `eslint-disable-next-line` comment is
fine for this prototype) and reading `entry.name` (falling back from any
custom key) in the `Pie` label renderer, rather than fighting recharts'
generic types.

## 10. Known environment & workflow gotchas (build history)

These were discovered empirically across multiple build runs on this
machine's mounted/synced folder and Vercel/GitHub setup. Treat them as
required practice, not optional troubleshooting tips — following them from
the start avoids re-discovering the same failures every run.

- **Git operations belong in the scratch directory, not the mounted repo.**
  The mounted `NABImmersion` folder's `.git` directory does not support
  `unlink` on lock files or loose-object temp files (every `rm`/git-internal
  cleanup fails with `Operation not permitted`), while `rename`/`mv` **does**
  work. In practice this means every `git add`/`commit`/`push` run directly
  inside the mounted folder leaves behind a fresh `index.lock` (and
  `HEAD.lock`, `refs/remotes/origin/*.lock`) that blocks the next git
  command. Do not try to `rm` these away — do all `git init`/`clone`/`add`/
  `commit`/`push` in the scratch build directory (a normal, non-mounted
  filesystem) instead, then copy the finished source tree into the mounted
  folder afterward purely so the person can see the files. If you must run
  git directly in the mounted folder for some reason, `mv` (never `rm`) any
  `index.lock`/`HEAD.lock` out of the way immediately before every single git
  command, including read commands like `git status`.
- **Pick the scratch build path with `df -h` first, not `/tmp`.** The root
  partition (`/`) on this machine runs close to full (routinely 99% used),
  so `npm install` in `/tmp` reliably fails with `ENOSPC` partway through.
  Build in a path on the larger `/sessions` partition instead (e.g.
  `~/build/<project-name>`), and confirm free space with `df -h` before
  running `npm install` if the build environment is unfamiliar.
- **A `git push` to `main` is the deploy trigger — Vercel API verification is
  optional, not a required gate.** Since Vercel auto-deploys from GitHub on
  push, the push succeeding (confirm with `git ls-remote origin main` if the
  local repo's own ref cache is unreliable per the point above) is sufficient
  to call the deploy done. If you additionally query the Vercel MCP/API to
  confirm the live deployment's commit SHA, expect it to rate-limit
  (`"The connector's server is rate-limiting requests"`) — wait ~20–30s and
  retry rather than treating a rate-limit as a deployment failure, and don't
  block finishing the task on it.
- **The project's auto-generated `*.vercel.app` deployment/team-alias domains
  require Vercel login (deployment protection) for anonymous visitors** — use
  the project's plain custom domain (see `domains` in the Vercel project,
  e.g. `protfolio-risk-dashboard-prototype.vercel.app`) when giving the
  person a link to open directly, not the `-<hash>-<team>.vercel.app` or
  `-<team>.vercel.app` deployment URLs.
- **`pdfjs-dist` v6 requires `Promise.withResolvers`, which is undefined on
  browsers older than Safari 17.4 / Chrome 119 / Firefox 121** — calling into
  pdfjs-dist on such a browser throws a bare, hard-to-diagnose
  `TypeError: undefined is not a function` the moment a PDF is parsed
  (confirmed via `grep -c withResolvers node_modules/pdfjs-dist/build/*.mjs`
  — 27 references, including the worker bundle). `pdfParser.ts` must polyfill
  `Promise.withResolvers` defensively before calling into pdfjs-dist. On top
  of that, PDF extraction is optional and best-effort per §8/§11 — a parsing
  failure of any kind (this one, a scanned/image-only PDF, a corrupt file)
  must never throw out of `handleRunAnalysis` and block the CSV analysis
  from completing; wrap the PDF branch in its own `try/catch`, set a
  `pdfParseFailed` flag on the `AnalysisResult`, and show a clear "could not
  extract text from `<file>`" message on the dashboard's Extracted Policy
  Highlights card (§12) instead of silently showing zero rules or, worse,
  failing the whole Run Analysis click.

## 11. Page 1 — Upload (`/`)

Heading `Portfolio Risk Analysis` (text-3xl, semibold). Subtext directly below:

> Upload your lending policy document and customer portfolio to generate an
> executive risk dashboard. All processing happens in your browser — no files
> are sent to a server.

Two-column grid (`sm:grid-cols-2`) of cards, each `rounded-xl border p-5 shadow-sm`:

1. **"1. Lending Policy & Risk Guidance (PDF)"** — subtext: *"Used to surface
   key policy rules and thresholds referenced on the dashboard. Optional, but
   recommended."* — native `<input type="file" accept="application/pdf">`
   styled with a black (`#171a1f`) file-select button. **PDF is optional.**
2. **"2. Customer Portfolio (CSV)"** — subtext: *"Expected columns:
   CustomerID, CustomerName, Industry, CreditScore, RepaymentStatus,
   LoanBalance. Column names are matched flexibly."* — native
   `<input type="file" accept=".csv,text/csv">`, same button styling.
   **CSV is required.**

Under each input, once a file is selected (by any means — manual pick or Load
Sample Data), show: `Selected: <filename>` in muted text with the filename
bolded. This must work even though native file inputs cannot be set
programmatically — implement it as controlled React state independent of the
native input's own "No file chosen" text, which will not update when Load
Sample Data runs (that's expected, not a bug).

Button row: primary **"Run Analysis"** button (`bg-[var(--accent)]`, disabled
until a CSV is selected, label becomes "Analysing…" while processing) and
secondary **"Load Sample Data"** button (bordered, label becomes "Loading…"
while fetching).

**Load Sample Data behaviour (important, was explicitly requested):** clicking
it fetches the two bundled files from `/sample-data/sample-customers.csv` and
`/sample-data/sample-lending-policy.pdf`, wraps them as `File` objects, and
populates the same PDF/CSV selection state as a manual upload — it does
**not** run the analysis or navigate anywhere. The person must still click
"Run Analysis" themselves. Track that the currently-selected files originated
from Load Sample Data (e.g. an `isSampleSelected` flag) so the eventual
`AnalysisResult.isSampleData` is set correctly; clear that flag if the person
manually changes either file afterwards.

Below the buttons, a **"How risk is scored"** card containing the exact
formula, weight percentages, and category thresholds (pull all three numbers
from `riskScoring.ts` constants, never hard-code them as literal text), plus a
pointer to `src/lib/riskScoring.ts` (as an inline `<code>` element) as the
file to edit.

## 12. Page 2 — Executive Dashboard (`/dashboard`)

Empty state (no result loaded): centered message "No analysis loaded yet" +
"Go to Upload" button. Otherwise, in this exact top-to-bottom order:

1. **Header.** `<h1>Executive Dashboard</h1>`; if `isSampleData`, a solid
   accent-filled pill badge immediately to its right reading `SAMPLE DATA`
   (uppercase, `bg-[var(--accent)] text-white`, not a subtle tint — this was
   explicitly upgraded from a light tint because it wasn't visible enough).
   Below the heading, one muted line:
   `{count} customers · {csvFileName} · {pdfFileName or "no policy uploaded"} · analysed {date}, {time}`.
   No "View Board Summary" link or button — that page does not exist.

2. **Category KPI cards** — 3 cards in a `sm:grid-cols-3` row, one per Green/Amber/Red,
   each showing: category name + coloured dot (top row), the raw count
   (large, `text-3xl`), then one muted line:
   `{pct of customers}% of customers · {compact currency} exposure ({pct of exposure}%)`.

3. **Total portfolio exposure** — single full-width card, label + large value
   in full (non-compact) currency format.

4. **Two-column chart row:**
   - Left: **"Customers & Exposure by Risk Category"** — a dual-Y-axis bar
     chart. Left axis = customer count, right axis = exposure ($, compact
     format). "Customers" bars are coloured per-category (green/amber/red via
     `<Cell>`); "Exposure" bars are the flat neutral `#333a42`. **The legend
     must not use recharts' default `<Legend>`** — because the Customers
     series has no single flat colour, the default legend swatch shows an
     unrelated colour. Use a custom legend `content` render that explicitly
     shows "Customers: ● Green ● Amber ● Red" plus a separate "● Exposure"
     swatch.
   - Right: **"Exposure by Industry Sector"** — a pie chart (`dataKey="exposure"`,
     `nameKey="industry"`), sliced with the blue→grey palette from §3, labels
     showing the industry name on each slice.

5. **Full-width Portfolio Risk Trend chart** (single card, not paired with
   anything else) — line chart, subtitle *"Illustrative trend leading up to
   current position"*, one line "Average Risk Score", generated client-side
   from a seeded pseudo-random walk that tapers to the real current average at
   the most recent point (see `generatePortfolioTrend`). **Do not add a
   separate risk-score-distribution/histogram chart** — one was built and then
   explicitly removed per feedback; the trend chart alone fills this row.

6. **Top 10 Highest-Risk Customers** table — full width, columns in this
   order: Customer, Industry, Credit Score, Repayment Status, Loan Balance,
   Risk Score, Category (as a `RiskBadge`). Sorted descending by risk score.

7. **Bottom row, two columns, paired together:**
   - Left: **"Recommended Actions"** — bulleted list (blue dot bullets) from
     `recommendedActions()`. Rules are: escalate Red customers by name if any
     exist; flag if Red exposure share > 15% of portfolio; watchlist Amber
     customers if any exist; flag the top industry by exposure if its share >
     30%; if none of the above trigger, show a single "within normal
     parameters" message. Never show an empty list.
   - Right: **"Scoring Methodology"** — restates the formula and the three
     threshold bands (pulled from `RISK_THRESHOLDS`, not hard-coded), then a
     **"Extracted Policy Highlights"** sub-section: if a PDF was uploaded, show
     `Heuristic extraction from {pdfFileName} — {pageCount} page(s) scanned.`
     followed by a scrollable (`max-h-64 overflow-y-auto`) list of the
     extracted rule statements, each with a left accent border. If no rules
     were found, say so explicitly. If no PDF was uploaded at all, say
     "No policy PDF was uploaded, so no rules were extracted for this
     analysis." — never leave this card blank with no explanation.

## 13. NavBar (`src/components/NavBar.tsx`)

Fixed structure, top to bottom:
- A 3px solid `var(--accent)` bar spanning the full width, above everything else.
- A white header bar (`border-b`) containing, left-aligned: a 28×28 logo mark
  (a solid `var(--accent)` rounded square with a smaller `var(--surface)`
  rounded square inset — simple geometric mark, no icon library, no emoji) next
  to the title `Portfolio Risk Dashboard` (semibold) with subtitle
  `Lending & credit risk prototype` (muted, small) underneath.
- Right-aligned nav: exactly two links, **"Upload"** (`/`) and
  **"Executive Dashboard"** (`/dashboard`), in that order. The active route's
  link is a filled `bg-[var(--accent)] text-white` pill; inactive links are
  plain text with a hover background. No third nav item.

Footer (in `layout.tsx`, below `<main>`): a single centered muted line —
*"Prototype for internal review only. No real customer data. All processing
happens locally in your browser — nothing is uploaded to a server."*

## 14. Sample data files — copy verbatim, never regenerate

The canonical source files live at
`/Users/aiacademy1/NABImmersion/sample-data/sample-customers.csv` and
`sample-lending-policy.pdf` (same directory this `DESIGN_SPEC.md` ships in,
so they travel with the guardrail configs to every laptop). **The build step
must copy these two files byte-for-byte into `public/sample-data/` in the new
project. Do not write a script or prompt an AI to generate new sample rows,
new company names, new PDF wording, or "similar" data — any regeneration,
even one that follows the shape described below, will produce different KPI
numbers, a different top-10 table, and different extracted policy rules on
every machine, which defeats the entire point of this spec.**

If, and only if, the canonical files are genuinely missing from
`/Users/aiacademy1/NABImmersion/sample-data/` on a given machine, fall back to recreating data
matching this shape exactly, then immediately save the result back into
`/Users/aiacademy1/NABImmersion/sample-data/` so it becomes the new canonical copy for that
machine going forward (do not let two laptops silently diverge):
- `sample-customers.csv` — 50 rows (header + 50 data rows), columns
  `CustomerID,CustomerName,Industry,CreditScore,RepaymentStatus,LoanBalance`.
  IDs `C001`–`C050`. Mix of industries: Manufacturing, Retail, Agriculture,
  Transport, Property, Healthcare, Construction, Hospitality, Technology,
  Energy, Food & Beverage. Repayment status values limited to: `Current`,
  `30 Days Late`, `60 Days Late`, `90+ Days Late`, `Default`.
- `sample-lending-policy.pdf` — a one-page real PDF (not a `.txt` file renamed)
  titled "NAB Lending Policy and Risk Guidance (Sample)" with numbered
  sections covering: minimum credit score, LVR limits, debt service ratio,
  arrears/delinquency handling, industry concentration limits, watchlist and
  provisioning, and collateral requirements — written so the keyword
  extraction in §8 picks up 6–8 rules from it.

This "fallback" path is a last resort for machine #1 only, not a normal part
of the build — once canonical files exist in `/Users/aiacademy1/NABImmersion/sample-data/`,
every subsequent laptop and every subsequent run must copy them as-is.

**Do not regenerate these from a synthetic data generator function** —
earlier iterations of this project used a `generateSampleCustomers()`
function and a hard-coded `SAMPLE_POLICY_TEXT` string; both were deliberately
replaced with real bundled files because Load Sample Data must exercise the
exact same CSV/PDF parsing code path as a manual upload, not a shortcut. If
`src/lib/sampleData.ts` exists from scaffolding, it is legacy/unused — either
delete it or never import from it.

## 15. Repo hygiene

- `main` as default branch, `.gitignore` for Node/Next (standard
  `create-next-app` output is sufficient), MIT `LICENSE`, and a `README.md`
  covering: what the prototype does, `npm install && npm run dev` to run
  locally, how to deploy to Vercel (Import Project → select repo → accept
  defaults, no env vars needed), and that `src/lib/riskScoring.ts` is the file
  to edit for scoring thresholds/weights.
- Commit messages should be descriptive enough that a reviewer can read the
  build history and understand *why*, not just *what* (see this project's own
  git log for the expected level of detail).
- If the target GitHub repo already has an initial commit (e.g. an
  auto-created placeholder README from repo creation), merge with
  `--allow-unrelated-histories -X ours` rather than force-pushing over it.

## 16. Explicit non-goals (do not build these)

- No backend, API routes, database, or server-side persistence of any kind.
- No authentication.
- No `localStorage`/`sessionStorage`/cookies for storing analysis data —
  in-memory React state only; a full page reload legitimately loses the
  current analysis, and that's correct behaviour, not a bug.
- No Board Summary / board-ready export page.
- No risk-score distribution/histogram chart.
- No real customer data anywhere in the repo.
- No third-party AI/LLM calls for PDF rule extraction — keyword heuristics only.

## 17. Acceptance checklist for a fresh build

Before calling a fresh run of the starter prompt "done", confirm:

- [ ] `npm run build` succeeds outside any mounted/synced directory, with a
      real per-route bundle size table in the output (not a suspiciously thin
      build — that was the symptom of the Next 16 routing bug).
- [ ] Exactly two routes exist: `/` and `/dashboard`.
- [ ] Nav shows exactly "Upload" and "Executive Dashboard", no third item.
- [ ] Load Sample Data populates both upload boxes and does **not** navigate
      away; Run Analysis is a separate, deliberate click.
- [ ] Dashboard shows, in order: header (+ Sample Data badge if applicable),
      3 KPI cards, total exposure card, category bar chart + industry pie
      chart, trend chart (full width, alone), top 10 table, Recommended
      Actions + Scoring Methodology (paired, bottom row).
  - [ ] The category bar chart's legend correctly shows Green/Amber/Red +
        Exposure, not a mismatched default colour.
- [ ] Colours match §3 exactly (spot-check `--accent: #2c5a8c`).
- [ ] `git log` on `main` shows the deployed commit; Vercel's latest
      production deployment for the project matches that commit SHA and
      returns HTTP 200 on `/` and `/dashboard`.
