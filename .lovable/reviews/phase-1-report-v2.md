# RYZITE Control Centre — Phase 1 Inspection Report (v2, repo inspected)

Date: 21 Nov 2026 · Status: **Repo inspected (read-only copy, latest commit `4673f5b`). Nothing changed in your repo, Sanity or Cloudflare.**

## 0. Headline findings from the code

1. **The website does not use Sanity at all.** No Sanity package, client, schema or query exists in the repo. Sanity project `hnm8jy5w` holds only 2 images. All page text lives in code files: `src/data/*.ts` (services, solutions, about, contact, reviews, resources) and `src/data/en.json` / `ta.json` / `si.json`.
2. **`/admin/` is Sveltia CMS**, a GitHub-based editor (`public/admin/`). Its config points at a **different repo, `Ryzite/ryzite-website`**, and only edits `en/ta/si.json` (nav, hero, sections, footer). Services, solutions and SEO text are not editable there.
3. **The site is in three languages:** English, Tamil and Sinhala. Every content module must handle all three.
4. **Every page shows the same title because of a code bug:** `MainLayout.astro` hardcodes `<title>RYZITE</title>` and ignores the page's `title`. Open Graph tags only appear when a page passes `openGraph`; no page sets a canonical URL; there's no sitemap.
5. **No analytics.** No GA4 tag exists. The playbook lists analytics and privacy policy as an open decision (§9, §14.8).
6. **Cloudflare:** Astro `output: "server"` on `@astrojs/cloudflare`, one KV binding `SESSION`. `wrangler.jsonc` names the Worker `ryzite-unified-platform`, but the live hostname is `ryzite-website.thulirkalcom.workers.dev`. Check which Worker is actually live.
7. **Contact form** posts to Web3Forms (public access key). The playbook marks the enquiry backend as open.
8. **Brand (approved in the playbook):** primary navy `#0B1C58`, Milky White page `#F9F8F0`, surfaces `#FDFFF5`, highlight `#FFFFFF`, Fira Sans + Fira Sans Extra Condensed. The playbook also forbids inventing projects, testimonials, metrics or contacts.

### What this means for "edit the live site from the dashboard"

The Control Centre can't edit content that only exists in code files. There are two real routes:

- **A. Move content into Sanity (recommended, matches your brief).** Create Sanity schemas for pages, services, solutions, team, articles, testimonials and SEO (three languages each). Copy today's content into a **staging dataset** first. Change the Astro pages to read from Sanity, and fix the title bug. The Control Centre then edits Sanity drafts and publishes. The Astro changes have to go into your repo; I'll prepare them as a ready-to-apply package on `feature/ryzite-control-centre`.
- **B. Keep content in code; the Control Centre commits file changes through GitHub.** This is how Sveltia works today. It's limited to simple text fields, every change redeploys the site, and structured editing of the TypeScript files is fragile.

---

## Original Phase 1 notes (from the live site, before repo access)

## Blocker (resolved): repository access

`github.com/Nisla1234/ryzite-unified-platform` is **private**. I cannot read it from here (GitHub returns 404 to unauthenticated requests).
Following the brief's rule, I have **not** invented its architecture. Everything below comes from the **live website** and the **public Sanity API**. Sections that need the code are marked *"needs repo"*.

Two platform facts that shape the plan:

- **Lovable cannot open a branch or push to an existing GitHub repo.** Lovable's GitHub sync only creates a *new* repository for this project. So `feature/ryzite-control-centre` in your existing repo cannot be created from here.
- **This project runs on React (TanStack Start), not Astro.** It is hosted on Lovable's own Cloudflare-based hosting, not on your `thulirkalcom` Workers account.

---

## 1. Existing project architecture (what can be seen from outside)

| Item | Finding |
|---|---|
| Framework | **Astro v7.4.2** (`<meta name="generator">`) |
| Hosting | Cloudflare Workers (`server: cloudflare`, `*.workers.dev`) |
| Fonts | Fira Sans, Fira Sans Extra Condensed, Noto Sans Tamil, Noto Sans Sinhala |
| Brand tokens (from site CSS) | brand `#0b1c58`, brand-hover `#16296f`, heading `#0a1734`, body `#24334f`, ink `#080c11`, paper `#fdfff5`, lime accent `#c9ff57`, lilac `#d3b8ff` |
| Logo | `/Original Logo.png` (matches the uploaded logo: chrome-blue serif "Ryzite" with a rising arrow) |
| `/admin/` | Already serves a page titled **"Ryzite Content Studio"** (probably an embedded Sanity Studio — *needs repo* to confirm) |
| `/admin/dashboard/` | 404 |

## 2. Website routes (from live navigation)

`/`, `/about`, `/services` (+11 service pages), `/solutions` (+9 solution pages), `/our-work`, `/articles`, `/packages`, `/how-we-work`, `/contact`, `/privacy-policy/`, `/terms-and-conditions/`.
Components visible in CSS bundles: `MainLayout`, `Offerings`, `ProcessRoad`, `TrustPrinciples`. Full component list: *needs repo*.

## 3. Sanity schemas and documents

Public query against project `hnm8jy5w` / `production`:

- `count(*)` → **2**
- Document types → only `sanity.imageAsset`

**This is the most important finding.** Either the dataset is private (needs a read token to see documents), or the website's pages, services and solutions are **written directly in the Astro code, not in Sanity**. If it is the second, the Control Centre cannot edit the live site through Sanity until that content is moved into Sanity and the Astro pages are changed to read from it. Schemas: *needs repo*.

## 4. Cloudflare deployment

Worker on `ryzite-website.thulirkalcom.workers.dev`. Wrangler config, bindings (D1/KV/R2), and deploy scripts: *needs repo*.

## 5. Recommended integration strategy

**Recommended: a separate Control Centre app, built in this Lovable project, connected to the same services.**

```text
ryzite-website (Astro, your Worker)           Control Centre (this Lovable project)
  /            public site  <── reads ──┐       login, dashboard, SEO, analytics,
  /admin/*  ── proxy route ─────────────┼──>    performance, AI, robot, users
                                        │
                     Sanity hnm8jy5w ───┘  <── writes drafts / publishes
                     GA4 Data API, PageSpeed API, AI  <── server-side only
```

- Admin accounts, sessions, access requests, audit logs, PageSpeed history, AI reports → **Lovable Cloud** database (instead of D1).
- Website content stays in **Sanity**; the Control Centre writes drafts and publishes with a server-side token.
- Same hostname: a small proxy rule in your existing Worker forwards `/admin/*` to the Control Centre. That one change is made in your repo (by you or a developer) — I can supply the exact code.
- Public website remains untouched until you approve the proxy and any Sanity-rendering changes.

## 6. Proposed navigation

Exactly as brief section 4 (Overview, Website Management, SEO Centre, Analytics Centre, Performance Centre, AI Intelligence, System Management). Every item gets a working page; pages whose service is not connected show a clear "Not connected — how to set up" state instead of fake numbers.

## 7. Required configuration (secret names only)

| Name | Purpose |
|---|---|
| `SANITY_API_TOKEN` | Editor token for project `hnm8jy5w` (read drafts, write, upload assets) |
| `GA4_PROPERTY_ID` | GA4 property number |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account with Viewer on the GA4 property |
| `PAGESPEED_API_KEY` | Google Cloud key with PageSpeed Insights API enabled |
| AI | Built-in Lovable AI (no key needed) |
| Email | Lovable's built-in email (needs a sender domain) for password reset and access-request notices |
| `ADMIN_BOOTSTRAP_PASSWORD` | One-time initial password for `ryzite_admin`, entered through the secure form only |
| Optional: `GITHUB_TOKEN`, Cloudflare API token | Read-only deployment status |

## 8. Missing integrations and credentials

1. Read access to the GitHub repo (or a ZIP of it).
2. Sanity editor token.
3. **No Google Analytics tag found on the live site** — GA4 reports will be empty until a GA4 tag is added to the website.
4. Google Cloud project with PageSpeed key + GA4 service account.
5. Email sender domain.

## 9. Conflicts and risks

- **Content may not be in Sanity** (see §3) — biggest scope risk.
- **SEO issues already visible:** every page has the same `<title>RYZITE</title>`; no Open Graph tags; no canonical URLs; `/sitemap.xml` returns 404. Descriptions exist and look good.
- `/admin/` is already used by "Ryzite Content Studio" — the proxy plan must move or replace it deliberately.
- Lovable cannot push a branch to your repo; repo-side changes (proxy, Sanity rendering, GA4 tag, per-page titles) must be applied by you or via a ZIP/patch I prepare.
- Username login needs an internal placeholder email per user; password reset will use the real recovery email stored on the profile.

## 10. Roadmap

| Phase | Work |
|---|---|
| 1 | This report ✅ + repo inspection once access is available |
| 2 | Design system from the logo, branded login, request access, forgot password, roles (Super Admin/Admin/Editor/Analyst), audit log, sidebar with all modules |
| 3 | Sanity connection: pages, services, solutions, portfolio, team, articles, testimonials, media (drafts + publish) |
| 4 | SEO Centre: validation, search preview, AI suggestions inbox, apply-to-draft / publish / revert |
| 5 | GA4: overview, acquisition, social, AI referrals, geo, devices, events |
| 6 | PageSpeed: 4 score rings, Core Web Vitals (field vs lab), audits, history, scheduled tests |
| 7 | AI Intelligence + RYZITE Robot (weighted health score, 5 moods, daily report history) |
| 8 | Integrations, deployment status, settings, profile |
| 9 | Proxy `/admin/*` on your Worker, test report, your approval before going live |
