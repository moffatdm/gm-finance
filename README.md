# Accounting, understood

A mobile-first, static study companion for the supplied Year 1 Financial Accounting Unit 2 and Unit 3 notes. Original teaching content: **16 short modules, 16 worked examples, 128 MCQs, 14 journal exercises, 4 running-balance ledgers, 3 trial balances and 4 structured exam-style scenarios**. UK terminology, GBP, no VAT unless stated.

Open the **gm-finance** folder as the project root. There are no runtime dependencies, accounts, API keys, analytics or external fonts. The app uses HTML, CSS, ES modules and JSON. It must be served over HTTP(S), not opened as a `file://` document.

## Run locally

With Node.js 22.12+ and pnpm 12.4.2 (pinned in `package.json`):

```sh
pnpm start
```

Open `http://127.0.0.1:4173`. Alternatively, any static web server can serve this folder. End the server with Ctrl+C.

Development checks:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm exec playwright install chromium
pnpm build
pnpm test:browser
```

Linux browser hosts may need `pnpm exec playwright install --with-deps chromium`. The browser tests use the built `dist/` site at a repository-style `/gm-finance/` URL. Test tooling is development-only; it is not shipped with the site.

## Publish to GitHub Pages

1. Create a GitHub repository and upload/push the contents of **this folder**, including `.github/`, `pnpm-lock.yaml`, `assets/` and `data/`. Do not upload the private lecture DOCX or progress backups. The four linked fundamentals PDFs in `assets/pdfs/` will be publicly accessible: ensure you have permission to redistribute them before publishing.
2. Keep the default branch named `main`, or update `.github/workflows/pages.yml` to your branch.
3. In repository **Settings → Pages**, set **Source** to **GitHub Actions**.
4. Push to `main` or run **Publish study space** from Actions. The workflow validates content, builds `dist/` and publishes only static site files. The deployment displays the live URL.

No domain or root URL is hard-coded. Asset/data URLs are relative and navigation uses hash routes, so `https://OWNER.github.io/REPO/` works without SPA rewrites.

**No-build alternative:** choose **Deploy from a branch → main → /(root)** in Pages settings and disable/remove the Actions workflow. The root `index.html` and `.nojekyll` work directly; no Node installation is needed for visitors or branch deployment.

This checkout has no configured GitHub remote. No repository has been created and nothing has been published by building these files.

## Crawlers and search indexing

The HTML includes `noindex, nofollow, noarchive, nosnippet, noimageindex` robot directives. `robots.txt` requests that all crawlers avoid all paths, and is included in both the root site and the built deployment.

**These are requests to compliant bots, not access control.** Public GitHub Pages cannot prevent arbitrary crawlers from fetching the site, JSON or PDFs. Direct PDF/JSON URLs do not inherit the HTML meta directive. GitHub Pages does not support configuring response headers such as `X-Robots-Tag` through this repository.

Robots rules only apply from the **origin root**: `https://OWNER.github.io/robots.txt` or `https://your-domain/robots.txt`. A project site's `https://OWNER.github.io/REPO/robots.txt` is not authoritative. For a project site, put the rules at the origin root (for example in the `OWNER.github.io` repository). If other projects should remain crawlable, use `Disallow: /REPO/` there instead of blocking the entire origin. A dedicated domain serving this site at `/` makes its bundled robots file authoritative.

`noindex` can only be read when the crawler fetches the HTML. Blocking crawling can leave a previously discovered URL listed without a snippet; it does not guarantee removal of existing search results or cached copies. Use the relevant search engine's removal tools if needed.

If preventing **all unauthorised access**, including bots, is required, do not publish on public GitHub Pages. Use hosting with server-side authentication/access controls, protect every asset as well as HTML, and keep the source repository private. A client-side password or checking a bot's user-agent is not sufficient.

## Learning and saved progress

- **Step by step:** all questions in a module, including applied ones.
- **I'm new to accounting:** adds everyday-language explanations to each lesson.
- **Challenge me:** only the applied question subset. Switch to Step by step to attempt the full module.
- Each MCQ attempt allows **one hint** and one answer. A confidence rating is required to proceed. Refresh resumes the current quiz, including its answer and used hint.
- A module is complete when marked read and all its questions have been attempted. Completion is not mastery. Accuracy uses latest answers, not best-ever scores.
- Confidence is the mean of latest self-ratings: unsure 0%, getting there 50%, confident 100%. It is separate from correctness and is not an exam prediction.
- Revision: a missed answer returns in 10 minutes; a correct unsure answer in 1 day. Correct/getting-there intervals are 1, 3, 7, 14, 30 days; correct/confident intervals 3, 7, 14, 30, 60 days. Consecutive correct attempts advance the interval; a miss resets it. Revision sessions include up to 10 due questions and ignore the challenge filter.
- Journal, ledger and trial-balance **successful completions** persist. Their unsubmitted inputs are intentionally temporary and clear when leaving the exercise. Exam-style written drafts persist automatically, but are self-marked, not machine-graded.
- Progress is versioned local storage under `accounting-understood:v1`, scoped to the browser's origin, not synced or sent to a server. Changing domain/device/browser does not carry it over. Other Pages sites on the same origin using this same key would share it.
- **My progress** provides JSON export/import and a confirmed reset. Invalid imports do not replace existing work. Corrupt/unavailable storage produces an explicit warning; the course still works in memory. Concurrent tabs stop saving when another tab changes progress, preventing silent overwrites.
- Browser data can be cleared or ephemeral in private mode. Back up before switching devices or clearing data. This is not an offline/PWA installation.

## Content and textbook boundaries

The supplied notes informed the scope; all explanations, worked examples and questions are original. **Exam-style does not mean official University of Glasgow past papers, an official marking scheme or predicted exam coverage.** Check actual module materials and lecturer policies.

Frank Wood references were checked against [Pearson's table of contents for *Frank Wood's Business Accounting*, 16th edition (2025)](https://www.pearson.com/en-gb/subject-catalog/p/frank-woods-business-accounting/P200000010734/9781292741697), print ISBN `9781292727783`. This may not be the same title/edition as the family's copy; confirm it before relying on chapter numbers. Topic/index pointers are included everywhere. Broader related chapters are explicitly labelled, with no invented dedicated chapter for warranties, grants or amortised-cost loans. No textbook material is reproduced.

The guide in the site explains corrections to lecture shorthand: dividends paid are equity distributions, LIFO is not permitted under IAS 2/FRS 102, and equal interest allocation is only a stated classroom simplification. Grant questions explicitly assume deferral and release against related costs. Units 2–3 are included; Unit 4 had only a heading.

## Add or edit a unit without changing JavaScript

### Fundamentals pages

The **Fudamentals** menu (spelling as requested) opens four original topic guides in numerical order: Debits & Credits, Account Types, The Ledger, and Financial Statements. Each has an **Open PDF** link to its unmodified original attachment, previous/next navigation, a new worked example and related existing exercises. Beginner mode adds plain-language explanations. These reference pages do not change module-completion or quiz scores.

Edit `data/fundamentals.json` (selected by `course.json` → `fundamentalsFile`) to add or change pages. Give each page a unique `id`, positive unique `order`, title/summary/sourceTitle, relative `pdf` path under `assets/pdfs/`, sections with `text` and `new`, a table, worked example and related lesson/activity links. The index and previous/next links sort by `order`, regardless of file order. PDF copyright notices are preserved; the original explanations are not transcriptions. All four attached PDFs are bundled, so their relative links work at GitHub Pages repository URLs. Remove any files you are not authorised to distribute before public deployment.

### Learning units

1. Copy the structure of `data/unit-2.json` into a new JSON file in `data/`.
2. Add `{ "id": "unit-4", "title": "...", "subtitle": "Unit 4 · ...", "file": "unit-4.json" }` to `data/course.json` → `units`. Update the course subtitle and source description.
3. Give the new file the matching unit `id`. Its `modules` must have stable, globally unique lower-case letter/number/hyphen IDs. Never rename existing module/question IDs just to reorder them: IDs link progress to content.
4. Each module needs `id`, `title`, `summary`, positive `minutes`, `sections`, `example`, `watch`, `terms`, `reading` and `questions`. Follow the existing files for the shapes:

```json
{
  "id": "new-topic",
  "title": "A new topic",
  "summary": "What the learner will understand.",
  "minutes": 10,
  "sections": [
    { "title": "A small idea", "text": "The standard explanation.", "new": "The everyday-language explanation." }
  ],
  "example": {
    "prompt": "The scenario.",
    "steps": ["A calculation or journal, with workings.", "An interpretation."],
    "result": "The takeaway."
  },
  "watch": "A common misconception.",
  "terms": [{ "term": "A word", "definition": "Its meaning." }],
  "reading": { "chapters": "Verify first, or write 'Use index'", "topics": "Search terms in the purchased edition." },
  "questions": [
    {
      "id": "new-topic-q1",
      "q": "A clear question?",
      "options": ["Correct answer", "Plausible error", "Another error", "A different error"],
      "answer": 0,
      "explain": "Why this is correct and what the likely trap is.",
      "hint": "One useful nudge, not just the answer.",
      "level": "core"
    }
  ]
}
```

`answer` is zero-based (0–3). Every MCQ has exactly four distinct options, an explanation, a hint and a `core` or `challenge` level. Add applied questions tagged `challenge` for that mode; a module with none shows a clear empty state in challenge mode. The production 16-module/100-question counts are baseline tests, not app limits.

5. Add optional activities to `data/activities.json`. Existing examples are the schemas:
   - `accounts`: all account labels offered in the journal builder.
   - `journals`: unit/module links, prompt/hint/explanation and `expected` lines `{ "account": "...", "dr": 100, "cr": 0 }`. All expected journals must balance. Split lines to the same account/side are accepted if their totals match.
   - `ledgers`: a signed debit-positive `opening` balance and rows of dated Dr/Cr movements. Correct running balances are derived, not duplicated in config.
   - `trialBalances`: closing balances with `amount` and `side: "dr" | "cr"`. The configured totals must agree.
   - `exams`: original scenario, suggested minutes, marks and parts with prompts, marks and indicative solutions. The part marks must add up.
6. Run `pnpm test` and preview. The app also validates JSON at startup and reports configuration errors rather than silently dropping content. No HTML is accepted in lesson strings: text is escaped on display.

Update the exercises and their tests together when correcting a numerical answer. Use independent workings rather than simply copying an answer into a test. Keep monetary values to no more than two decimal places. Update the reading pointers only after checking the relevant edition.
