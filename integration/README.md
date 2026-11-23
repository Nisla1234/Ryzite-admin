# RYZITE Website & Control Centre Integration Notes

## Architecture Bridge

- **Control Centre**: TanStack Start + React + Drizzle D1 + Cloudflare Workers
- **Main Website**: `Nisla1234/ryzite-unified-platform` (Astro + `@astrojs/cloudflare`, live at `https://ryzite-website.thulirkalcom.workers.dev/`)
- **Sanity Project**: `hnm8jy5w` (`production` dataset)

## Public Integration Endpoints Exposed by Control Centre

1. `POST /api/enquiries` — Accepts project enquiries from website forms (CORS enabled, Zod validated, honeypot `botcheck`, rate-limited, optional `x-ryzite-webhook-secret`).
2. `GET /api/public/content` — Returns published CMS documents and non-secret SEO defaults (`titleSuffix`, `defaultOgImage`, `defaultRobots`) for Astro consumption with graceful fallback.
3. `GET /api/public/sitemap.xml` — Dynamic XML sitemap built from published Control Centre documents.
4. `GET /api/public/robots.txt` — Dynamic `robots.txt` referencing `sitemap.xml`.

## Prepared Main Website Patches (`feature/ryzite-control-centre-integration`)

- Fixed `src/layouts/MainLayout.astro` `<title>{title}</title>`, canonical links, Open Graph meta tags, JSON-LD slot, and optional `GA_MEASUREMENT_ID` (`gtag.js`).
- Added `src/pages/sitemap.xml.ts` and `src/pages/robots.txt.ts` to eliminate the live `/sitemap.xml` 404.
- Added `src/lib/cms.ts` resilient Control Centre reader with 1500ms timeout and fallback to `src/data/*`.
- Updated `src/pages/contact.astro` to mirror submitted enquiries to `PUBLIC_CONTROL_CENTRE_ENQUIRY_URL` without altering existing Web3Forms + WhatsApp confirmation behavior.
