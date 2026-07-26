Tech stack: 
Next.js (App Router, TypeScript) with Tailwind CSS. All logic runs client-side — no backend, no database, no external APIs, no authentication. Use the default Next.js build so it deploys to Vercel with zero configuration. Keep dependencies minimal. Finish the build in 10-12 minutes.

Build environment:
This project folder is a synced/mounted folder, not a native local disk — npm install, npm run dev/build, and any node_modules churn can be unreliable here (rapid rename/delete operations can hit ENOTEMPTY and "Operation not permitted" errors, background/backgrounded processes can be left orphaned holding file locks, and in the worst case a bundler's use of mmap against node_modules/.next can crash outright with a SIGBUS "Bus error" on some mount implementations).

Preferred approach — keep source visible live, keep risk off the mount: write every source file (app/, components/, lib/, public/, config files, package.json, README, LICENSE) directly into this repo folder as normal, so the person can watch them appear/update live rather than only seeing a batch copy at the end. Before running npm install, redirect the two risk-prone directories to local (non-mounted) storage via symlinks, e.g.:
  mkdir -p ~/build-cache/<project-name>/node_modules ~/build-cache/<project-name>/.next
  ln -s ~/build-cache/<project-name>/node_modules ./node_modules
  ln -s ~/build-cache/<project-name>/.next ./.next
Then run npm install / npm run dev / npm run build normally from inside this folder — the mmap-heavy install/build artifacts live on stable local disk while every source file you write is still the real, visible file in this repo. Also clear .next before each build to keep the cache small; this reduces (but does not eliminate) the odds of a bad mmap window, so treat it as a supplement to the symlinks, not a substitute for them.

Fallback if symlinks aren't available in the environment: do all npm install / dev server / build work in a scratch directory (e.g. /tmp/<project-name>) fully outside this mounted folder, then copy only the source files (app/, components/, lib/, public/, config files, package.json, package-lock.json, README, LICENSE — never node_modules or .next) into this repo folder, then run git add/commit/push from here — understanding that this fallback means the person won't see files update live, only in batches. Do not run npm install inside this repo folder without first setting up the symlinks above. Vercel installs dependencies itself from package.json during deployment, so a local node_modules here is never required for deployment — only for local dev/build verification.

Repo hygiene: 
main as the default branch, a .gitignore for Node/Next, an MIT LICENSE, and a README.md that covers what the prototype does, how to run it locally (npm install && npm run dev), how to deploy to Vercel (Import Project → select the GitHub repo → accept defaults), and exactly which file to edit to change scoring thresholds. Commit and push to the main branch of the specified Github repo defined in the configs file with clear commit messages so a reviewer can read the build history.

Agent workflow: 
After deployment, can you ask the user if they want to make iterations or add an extension prompt which builds another feature. Make sure the question is clear in the UI. Don't make it lost lots of text paragraphs, display it in a pop up window.

After user has added their extension prompt or iterations, can you ask them if they are happy with the changes and are happy to deploy.

Every time you run a command during your workflow, can you provide a high level description to an executive audience on what you are doing.

Task list / progress language: when planning tasks from the starter prompt (and in any in-progress status updates), describe them as the actual features being built for the dashboard — e.g. "Build the risk scoring engine", "Build the executive dashboard (KPI cards, charts, top 10 risk table)", "Publish source code to GitHub" — not as internal implementation steps like "write all source files per design spec" or "read DESIGN_SPEC.md". Assume the audience is executive leadership, not a developer reading a build log.

In the initial planning stage when the first prompt is inputed, can you make sure that the agent lists out these tasks as a baseline:
* Scaffold Next.js app + config files
* Build risk scoring engine
* Build Upload page and components
* Build Executive Dashboard page
* Copy sample data + write README
* Install deps and verify build/dev server
* Commit and push to GitHub
* Verify Vercel deployment

If there are additional features in the starter prompt that are not listed above, add them to the appropriate slot.

Complete the first task before moving onto the next. I want the user to be able to see all of the tasks being completed sequentially so that there is full visibility on each step of the build. Using subagents and multitasking is not ideal.

Access: 
Don't ask the user for approvals during the first iteration/build run. Run completely automously. Once the app has had its initial deployment to Vercel then you can prompt the user for feedback as such:

Once the user makes there iterations and if adds an extension prompt, can you make sure after they deploy the change, as them if they would like to continue add more/modify.


Design: 
Calm, restrained banking aesthetic. Use the NAB Design Guide skill to apply NAB branding to this app.

Working style:
After scaffolding, run the dev server yourself and confirm the form renders and the result renders for at least one sample. When you hit a decision point (a threshold, a UX trade-off, a naming choice), state your reasoning in one line before you commit. At the end, print a short checklist in the terminal of what's included, what's deliberately out of scope,

Out-of-scope guardrails: 
No real customer data. No authentication. Do not persist anything to storage