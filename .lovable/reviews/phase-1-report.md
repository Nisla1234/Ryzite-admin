# RYZITE Control Centre — Phase 1 Inspection Report

Date: 21 Nov 2026 · Status: **Paused before any build, as the brief requires**

## 0. Blocker: repository access

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
