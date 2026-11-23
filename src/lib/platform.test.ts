// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  createAiTask,
  createEnquiry,
  getPlatformSettings,
  listCmsDocuments,
  listCmsRevisions,
  listEnquiries,
  savePlatformSettings,
  updateAiTask,
  updateEnquiry,
  upsertCmsDocument,
} from "./platform-db.server";
import {
  analyzeHtmlSeo,
  evaluateSiteSeoIssues,
  generateRobotsTxt,
  generateSitemapXml,
} from "./seo-analyzer";

describe("RYZITE Control Centre platform & SEO integration", () => {
  it("extracts SEO tags, JSON-LD, GA4 tag, and internal links accurately", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <title>RYZITE | Home</title>
          <meta name="description" content="One Agency. All Your Business Solutions in Sri Lanka and worldwide." />
          <link rel="canonical" href="https://ryzite-website.thulirkalcom.workers.dev/" />
          <meta property="og:title" content="RYZITE Digital" />
          <meta property="og:description" content="Digital Marketing & Technology" />
          <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"RYZITE"}</script>
          <script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ"></script>
        </head>
        <body>
          <h1>Turning Ideas Into Digital Possibilities</h1>
          <a href="/about/">About</a>
          <a href="https://ryzite-website.thulirkalcom.workers.dev/services/">Services</a>
        </body>
      </html>`;

    const parsed = analyzeHtmlSeo({
      url: "https://ryzite-website.thulirkalcom.workers.dev/",
      pagePath: "/",
      statusCode: 200,
      responseMs: 120,
      html,
      baseOrigin: "https://ryzite-website.thulirkalcom.workers.dev",
    });

    expect(parsed.title).toBe("RYZITE | Home");
    expect(parsed.h1Count).toBe(1);
    expect(parsed.hasJsonLd).toBe(true);
    expect(parsed.jsonLdTypes).toEqual(["Organization"]);
    expect(parsed.hasGa4Tag).toBe(true);
    expect(parsed.ga4MeasurementId).toBe("G-ABC123XYZ");
    expect(parsed.internalLinks).toContain("/about/");
    expect(parsed.internalLinks).toContain("/services/");
  });

  it("flags duplicate titles, missing canonical, missing sitemap, and missing GA4 tag", () => {
    const p1 = analyzeHtmlSeo({
      url: "https://ryzite-website.thulirkalcom.workers.dev/",
      pagePath: "/",
      statusCode: 200,
      responseMs: 100,
      html: "<html><head><title>RYZITE</title></head><body><h1>Hero</h1></body></html>",
      baseOrigin: "https://ryzite-website.thulirkalcom.workers.dev",
    });
    const p2 = analyzeHtmlSeo({
      url: "https://ryzite-website.thulirkalcom.workers.dev/about/",
      pagePath: "/about/",
      statusCode: 200,
      responseMs: 110,
      html: "<html><head><title>RYZITE</title></head><body><h1>About</h1></body></html>",
      baseOrigin: "https://ryzite-website.thulirkalcom.workers.dev",
    });

    const issues = evaluateSiteSeoIssues([p1, p2], {
      sitemapStatus: 404,
      robotsStatus: 200,
      robotsAllowsIndex: true,
    });

    const codes = issues.map((i) => i.code);
    expect(codes).toContain("DUPLICATE_TITLES");
    expect(codes).toContain("MISSING_CANONICAL");
    expect(codes).toContain("MISSING_SITEMAP");
    expect(codes).toContain("MISSING_GA4_TAG");
  });

  it("generates valid XML sitemap and robots.txt", () => {
    const xml = generateSitemapXml("https://ryzite-website.thulirkalcom.workers.dev", [
      { path: "/", priority: "1.0" },
      { path: "/services/seo-growth/", priority: "0.7" },
    ]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<loc>https://ryzite-website.thulirkalcom.workers.dev/</loc>");
    expect(xml).toContain(
      "<loc>https://ryzite-website.thulirkalcom.workers.dev/services/seo-growth/</loc>",
    );

    const robots = generateRobotsTxt("https://ryzite-website.thulirkalcom.workers.dev");
    expect(robots).toContain(
      "Sitemap: https://ryzite-website.thulirkalcom.workers.dev/sitemap.xml",
    );
  });

  it("applies all D1 migrations including 0003_control_centre_modules.sql cleanly in sqlite", () => {
    const db = new DatabaseSync(":memory:");
    const files = [
      "0000_init.sql",
      "0001_seed_admin.sql",
      "0002_update_primary_admin_email.sql",
      "0003_control_centre_modules.sql",
    ];
    for (const file of files) {
      db.exec(readFileSync(resolve(process.cwd(), "src/db/d1-migrations", file), "utf8"));
    }

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "cms_documents",
        "cms_revisions",
        "media_assets",
        "website_enquiries",
        "seo_audits",
        "seo_issues",
        "pagespeed_reports",
        "ai_reports",
        "ai_tasks",
        "system_settings",
      ]),
    );
    db.close();
  });

  it("persists CMS documents with revisions, enquiries, AI tasks, and platform settings", async () => {
    const docs = await listCmsDocuments({ docTypes: ["page"] });
    expect(docs.length).toBeGreaterThanOrEqual(9);

    const saved = await upsertCmsDocument({
      id: "doc-page-about",
      doc_type: "page",
      slug: "/about/",
      title: "About RYZITE Updated",
      summary: "Updated summary",
      status: "draft",
      payload: { test: true },
      seo: { seoTitle: "About RYZITE | Digital Agency" },
      editor_id: "user-admin",
      editor_label: "ryzite_admin",
      change_summary: "Updated about copy",
      action: "draft_saved",
    });
    expect(saved.title).toBe("About RYZITE Updated");

    const revs = await listCmsRevisions("doc-page-about");
    expect(revs.length).toBeGreaterThanOrEqual(2);

    const enq = await createEnquiry({
      name: "Nimal Perera",
      business: "Ceylon Crafts",
      email: "nimal@example.com",
      message: "Interested in the Growth Package website build.",
    });
    await updateEnquiry(enq.id, { status: "in_review", internal_notes: "Scheduled call" });
    const allEnq = await listEnquiries({ status: "in_review" });
    expect(allEnq.some((e) => e.id === enq.id && e.internal_notes === "Scheduled call")).toBe(true);

    const task = await createAiTask({
      title: "Deploy Astro sitemap.xml",
      priority: "high",
      source: "seo",
      created_by: "ryzite_admin",
    });
    await updateAiTask(task.id, { status: "done" });

    const nextSettings = await savePlatformSettings({ sessionMaxAgeHours: 12 }, "ryzite_admin");
    expect(nextSettings.sessionMaxAgeHours).toBe(12);
    expect((await getPlatformSettings()).sessionMaxAgeHours).toBe(12);
  });
});
