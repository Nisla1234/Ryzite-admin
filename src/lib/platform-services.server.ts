import { createSign } from "node:crypto";
import { LIVE_SITE_URL } from "./nav";
import { WEBSITE_CORE_PATHS } from "./platform-seed.server";
import {
  getMediaReferencesCount,
  listLatestSeoAudits,
  listPageSpeedReports,
  listStoredMediaAssets,
  savePageSpeedReport,
  saveSeoCrawlResults,
  upsertMediaAsset,
  type CmsDocumentRecord,
  type MediaAssetRecord,
  type PageSpeedReportRecord,
  type SeoAuditRecord,
} from "./platform-db.server";
import { getD1Database, getRuntimeSecret } from "./runtime-env.server";
import { analyzeHtmlSeo, evaluateSiteSeoIssues, type ParsedPageSeo } from "./seo-analyzer";
import type { JsonValue } from "./session";

const SANITY_PROJECT = "hnm8jy5w";
const SANITY_DATASET = "production";
const SANITY_API_VER = "2024-01-01";
const GITHUB_REPO = "Nisla1234/ryzite-unified-platform";
const UA = "RYZITE-Control-Centre/1.0";

async function timedFetch(url: string, init: RequestInit = {}, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "user-agent": UA, ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// Sanity CMS Connector (hnm8jy5w / production)
// ============================================================================

export async function fetchSanitySummaryAndAssets(): Promise<{
  reachable: boolean;
  hasWriteToken: boolean;
  docsCount: number;
  assets: MediaAssetRecord[];
  documents: Array<{
    _id: string;
    _type: string;
    _updatedAt?: string;
    title?: string;
    slug?: string;
  }>;
  error?: string;
}> {
  const hasWriteToken = Boolean(getRuntimeSecret("SANITY_API_TOKEN"));
  const query = encodeURIComponent(
    `{
      "documents": *[!(_id in path("_.**")) && !(_type match "sanity.*")]{_id, _type, _updatedAt, title, "slug": slug.current},
      "assets": *[_type == "sanity.imageAsset"] | order(_createdAt desc) [0...100]{
        _id, originalFilename, url, mimeType, size, _createdAt, _updatedAt,
        "width": metadata.dimensions.width,
        "height": metadata.dimensions.height
      }
    }`,
  );
  try {
    const res = await timedFetch(
      `https://${SANITY_PROJECT}.api.sanity.io/${SANITY_API_VER}/data/query/${SANITY_DATASET}?query=${query}`,
    );
    if (!res.ok) {
      return {
        reachable: false,
        hasWriteToken,
        docsCount: 0,
        assets: [],
        documents: [],
        error: `Sanity HTTP ${res.status}`,
      };
    }
    const json = (await res.json()) as {
      result?: {
        documents?: Array<{
          _id: string;
          _type: string;
          _updatedAt?: string;
          title?: string;
          slug?: string;
        }>;
        assets?: Array<{
          _id: string;
          originalFilename?: string;
          url: string;
          mimeType?: string;
          size?: number;
          width?: number;
          height?: number;
          _createdAt?: string;
          _updatedAt?: string;
        }>;
      };
    };

    const stored = await listStoredMediaAssets();
    const storedMap = new Map(stored.map((m) => [m.asset_key, m]));
    const docs = json.result?.documents ?? [];
    const assets: MediaAssetRecord[] = (json.result?.assets ?? []).map((a) => {
      const meta = storedMap.get(`sanity:${a._id}`);
      return {
        id: meta?.id ?? a._id,
        source: "sanity",
        asset_key: `sanity:${a._id}`,
        url: a.url,
        filename: a.originalFilename || a._id,
        mime_type: a.mimeType || "image/png",
        width: a.width ?? null,
        height: a.height ?? null,
        size_bytes: a.size ?? null,
        alt_text: meta?.alt_text ?? "",
        caption: meta?.caption ?? "",
        folder: meta?.folder ?? "sanity",
        data_url: null,
        uploaded_by: meta?.uploaded_by ?? null,
        created_at: a._createdAt ?? new Date().toISOString(),
        updated_at: meta?.updated_at ?? a._updatedAt ?? new Date().toISOString(),
      };
    });

    return {
      reachable: true,
      hasWriteToken,
      docsCount: docs.length,
      assets,
      documents: docs,
    };
  } catch (e) {
    return {
      reachable: false,
      hasWriteToken,
      docsCount: 0,
      assets: [],
      documents: [],
      error: e instanceof Error ? e.message : "Sanity request failed",
    };
  }
}

export async function pushDocumentToSanity(
  doc: CmsDocumentRecord,
  publish: boolean,
): Promise<{ synced: boolean; sanityId?: string; reason?: string }> {
  const token = getRuntimeSecret("SANITY_API_TOKEN");
  if (!token) {
    return {
      synced: false,
      reason: "SANITY_API_TOKEN is not configured; change is persisted in Control Centre D1 only.",
    };
  }
  const sanityDocId = doc.sanity_id || (publish ? `ryzite-${doc.id}` : `drafts.ryzite-${doc.id}`);
  const mutation = {
    mutations: [
      {
        createOrReplace: {
          _id: sanityDocId,
          _type: "ryziteContentDocument",
          controlCentreId: doc.id,
          docType: doc.doc_type,
          slug: { _type: "slug", current: doc.slug },
          title: doc.title,
          summary: doc.summary,
          category: doc.category,
          status: doc.status,
          sortOrder: doc.sort_order,
          payloadJson: JSON.stringify(doc.payload),
          seo: doc.seo,
          updatedAt: doc.updated_at,
        },
      },
    ],
  };

  try {
    const res = await timedFetch(
      `https://${SANITY_PROJECT}.api.sanity.io/${SANITY_API_VER}/data/mutate/${SANITY_DATASET}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(mutation),
      },
    );
    if (!res.ok) {
      return {
        synced: false,
        reason: `Sanity API HTTP ${res.status}: ${(await res.text()).slice(0, 140)}`,
      };
    }
    return { synced: true, sanityId: sanityDocId };
  } catch (e) {
    return { synced: false, reason: e instanceof Error ? e.message : "Sanity push failed" };
  }
}

export async function uploadImageAsset(input: {
  filename: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";
  base64Data: string;
  altText: string;
  caption: string;
  folder: string;
  uploadedBy: string;
}): Promise<{ asset: MediaAssetRecord; storedIn: "sanity" | "d1"; note?: string }> {
  const token = getRuntimeSecret("SANITY_API_TOKEN");
  const bytes = Buffer.from(input.base64Data, "base64");

  if (token) {
    const res = await timedFetch(
      `https://${SANITY_PROJECT}.api.sanity.io/${SANITY_API_VER}/assets/images/${SANITY_DATASET}?filename=${encodeURIComponent(input.filename)}`,
      {
        method: "POST",
        headers: {
          "content-type": input.mimeType,
          Authorization: `Bearer ${token}`,
        },
        body: bytes,
      },
    );
    if (res.ok) {
      const json = (await res.json()) as {
        document?: {
          _id: string;
          url: string;
          originalFilename?: string;
          size?: number;
          metadata?: { dimensions?: { width?: number; height?: number } };
        };
      };
      if (json.document) {
        const asset = await upsertMediaAsset({
          source: "sanity",
          asset_key: `sanity:${json.document._id}`,
          url: json.document.url,
          filename: json.document.originalFilename ?? input.filename,
          mime_type: input.mimeType,
          width: json.document.metadata?.dimensions?.width ?? null,
          height: json.document.metadata?.dimensions?.height ?? null,
          size_bytes: json.document.size ?? bytes.length,
          alt_text: input.altText,
          caption: input.caption,
          folder: input.folder,
          uploaded_by: input.uploadedBy,
        });
        return { asset, storedIn: "sanity" };
      }
    }
  }

  const key = `d1:media-${Date.now()}-${input.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const dataUrl = `data:${input.mimeType};base64,${input.base64Data}`;
  const asset = await upsertMediaAsset({
    source: "d1",
    asset_key: key,
    url: dataUrl,
    filename: input.filename,
    mime_type: input.mimeType,
    size_bytes: bytes.length,
    alt_text: input.altText,
    caption: input.caption,
    folder: input.folder,
    data_url: dataUrl,
    uploaded_by: input.uploadedBy,
  });

  return {
    asset,
    storedIn: "d1",
    note: token
      ? "Sanity asset upload returned an error; stored in Control Centre D1 instead."
      : "SANITY_API_TOKEN is not configured; stored in Control Centre D1 media storage.",
  };
}

export async function safeDeleteMediaAsset(
  assetKey: string,
): Promise<{ ok: boolean; error?: string; referenceCount?: number }> {
  const stored = (await listStoredMediaAssets()).find((m) => m.asset_key === assetKey);
  const refs = await getMediaReferencesCount(stored?.url || assetKey);
  if (refs > 0) {
    return {
      ok: false,
      referenceCount: refs,
      error: `Asset is still referenced by ${refs} website document(s). Remove those references first.`,
    };
  }
  if (assetKey.startsWith("github:")) {
    return {
      ok: false,
      error:
        "GitHub repository images are managed in Nisla1234/ryzite-unified-platform and cannot be deleted from here.",
    };
  }
  if (assetKey.startsWith("sanity:")) {
    const token = getRuntimeSecret("SANITY_API_TOKEN");
    if (!token) {
      return { ok: false, error: "Deleting Sanity assets requires SANITY_API_TOKEN." };
    }
    const sanityId = assetKey.replace(/^sanity:/, "");
    const res = await timedFetch(
      `https://${SANITY_PROJECT}.api.sanity.io/${SANITY_API_VER}/data/mutate/${SANITY_DATASET}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mutations: [{ delete: { id: sanityId } }] }),
      },
    );
    if (!res.ok) {
      return { ok: false, error: `Sanity delete HTTP ${res.status}` };
    }
  }
  const { deleteStoredMediaAsset } = await import("./platform-db.server");
  await deleteStoredMediaAsset(assetKey);
  return { ok: true };
}

// ============================================================================
// GitHub Inventory (Main Website Repo: Nisla1234/ryzite-unified-platform)
// ============================================================================

export async function fetchGithubMediaAssets(): Promise<{
  assets: MediaAssetRecord[];
  error?: string;
}> {
  const token = getRuntimeSecret("GITHUB_TOKEN");
  try {
    const res = await timedFetch(
      `https://api.github.com/repos/${GITHUB_REPO}/git/trees/main?recursive=1`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    );
    if (!res.ok) {
      return { assets: [], error: `GitHub HTTP ${res.status}` };
    }
    const json = (await res.json()) as {
      tree?: Array<{ path: string; type: string; size?: number }>;
    };
    const stored = await listStoredMediaAssets();
    const storedMap = new Map(stored.map((m) => [m.asset_key, m]));
    const imgExts = /\.(webp|png|jpe?g|svg|avif|gif)$/i;
    const baseLive = LIVE_SITE_URL.replace(/\/+$/, "");

    const assets: MediaAssetRecord[] = (json.tree ?? [])
      .filter(
        (n) =>
          n.type === "blob" &&
          (n.path.startsWith("public/images/") || n.path.startsWith("public/assets/")) &&
          imgExts.test(n.path),
      )
      .map((n) => {
        const publicRel = n.path.replace(/^public/, "");
        const filename = n.path.split("/").pop() || n.path;
        const folder = n.path.split("/")[2] || "root";
        const ext = filename.split(".").pop()?.toLowerCase() ?? "webp";
        const mime =
          ext === "svg"
            ? "image/svg+xml"
            : ext === "png"
              ? "image/png"
              : ext === "jpg" || ext === "jpeg"
                ? "image/jpeg"
                : `image/${ext}`;
        const key = `github:${n.path}`;
        const meta = storedMap.get(key);
        return {
          id: meta?.id ?? key,
          source: "github" as const,
          asset_key: key,
          url: `${baseLive}${publicRel}`,
          filename,
          mime_type: mime,
          width: null,
          height: null,
          size_bytes: n.size ?? null,
          alt_text: meta?.alt_text ?? "",
          caption: meta?.caption ?? "",
          folder,
          data_url: null,
          uploaded_by: meta?.uploaded_by ?? null,
          created_at: meta?.created_at ?? "2026-11-21T00:00:00.000Z",
          updated_at: meta?.updated_at ?? "2026-11-21T00:00:00.000Z",
        };
      });

    return { assets };
  } catch (e) {
    return { assets: [], error: e instanceof Error ? e.message : "GitHub tree query failed" };
  }
}

export async function fetchDeploymentAndRepoHealth() {
  const token = getRuntimeSecret("GITHUB_TOKEN");
  const cfToken = getRuntimeSecret("CLOUDFLARE_API_TOKEN");
  const cfAccount = getRuntimeSecret("CLOUDFLARE_ACCOUNT_ID");
  const d1Bound = getD1Database() !== null;
  const origin = LIVE_SITE_URL.replace(/\/+$/, "");

  const [siteResp, commitsResp, branchesResp, cfResp] = await Promise.all([
    (async () => {
      const start = Date.now();
      try {
        const r = await timedFetch(origin, { redirect: "manual" }, 8000);
        return {
          ok: r.status >= 200 && r.status < 400,
          status: r.status,
          ms: Date.now() - start,
          checkedAt: new Date().toISOString(),
        };
      } catch (e) {
        return {
          ok: false,
          status: 0,
          ms: Date.now() - start,
          error: e instanceof Error ? e.message : "Unreachable",
          checkedAt: new Date().toISOString(),
        };
      }
    })(),
    (async () => {
      try {
        const r = await timedFetch(
          `https://api.github.com/repos/${GITHUB_REPO}/commits?per_page=8`,
          {
            headers: {
              Accept: "application/vnd.github+json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
        );
        if (!r.ok) return { ok: false, commits: [], error: `GitHub HTTP ${r.status}` };
        const data = (await r.json()) as Array<{
          sha: string;
          html_url: string;
          commit: { message: string; author?: { name?: string; date?: string } };
        }>;
        return {
          ok: true,
          commits: data.map((c) => ({
            sha: c.sha.slice(0, 7),
            fullSha: c.sha,
            message: c.commit.message.split("\n")[0],
            author: c.commit.author?.name ?? "Unknown",
            date: c.commit.author?.date ?? "",
            url: c.html_url,
          })),
        };
      } catch (e) {
        return { ok: false, commits: [], error: e instanceof Error ? e.message : "Failed" };
      }
    })(),
    (async () => {
      try {
        const r = await timedFetch(`https://api.github.com/repos/${GITHUB_REPO}/branches`, {
          headers: {
            Accept: "application/vnd.github+json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!r.ok) return [];
        const data = (await r.json()) as Array<{ name: string; commit: { sha: string } }>;
        return data.map((b) => ({ name: b.name, sha: b.commit.sha.slice(0, 7) }));
      } catch {
        return [];
      }
    })(),
    (async () => {
      if (!cfToken || !cfAccount) {
        return {
          configured: false as const,
          deployments: [],
          note: "Configure CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID to retrieve Worker deployment history.",
        };
      }
      try {
        const r = await timedFetch(
          `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/workers/scripts/ryzite-website/deployments`,
          { headers: { Authorization: `Bearer ${cfToken}` } },
        );
        if (!r.ok) {
          return {
            configured: true as const,
            deployments: [],
            error: `Cloudflare API HTTP ${r.status}`,
          };
        }
        const json = (await r.json()) as {
          result?: {
            items?: Array<{ id: string; created_on: string; source?: string; strategy?: string }>;
          };
        };
        return {
          configured: true as const,
          deployments: (json.result?.items ?? []).slice(0, 10).map((d) => ({
            id: d.id,
            createdOn: d.created_on,
            source: d.source ?? "wrangler",
            strategy: d.strategy ?? "percentage",
          })),
        };
      } catch (e) {
        return {
          configured: true as const,
          deployments: [],
          error: e instanceof Error ? e.message : "Cloudflare API request failed",
        };
      }
    })(),
  ]);

  return {
    site: siteResp,
    d1Bound,
    githubRepo: GITHUB_REPO,
    commits: commitsResp,
    branches: branchesResp,
    cloudflare: cfResp,
  };
}

// ============================================================================
// Live Multi-Page SEO Crawler
// ============================================================================

export async function runLiveSiteSeoCrawl(paths = WEBSITE_CORE_PATHS) {
  const origin = LIVE_SITE_URL.replace(/\/+$/, "");
  const checkedAt = new Date().toISOString();
  const parsedPages: ParsedPageSeo[] = [];

  for (const path of paths) {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${origin}${cleanPath}`;
    const started = Date.now();
    try {
      const res = await timedFetch(url, { redirect: "follow" }, 9000);
      const ms = Date.now() - started;
      const html = res.status < 400 ? await res.text() : "";
      parsedPages.push(
        analyzeHtmlSeo({
          url,
          pagePath: cleanPath,
          statusCode: res.status,
          responseMs: ms,
          html,
          baseOrigin: origin,
        }),
      );
    } catch {
      parsedPages.push(
        analyzeHtmlSeo({
          url,
          pagePath: cleanPath,
          statusCode: 0,
          responseMs: Date.now() - started,
          html: "",
          baseOrigin: origin,
        }),
      );
    }
  }

  const [sitemapRes, robotsRes] = await Promise.all([
    timedFetch(`${origin}/sitemap.xml`, { redirect: "manual" }, 6000).catch(() => null),
    timedFetch(`${origin}/robots.txt`, { redirect: "manual" }, 6000).catch(() => null),
  ]);

  const sitemapStatus = sitemapRes?.status ?? 0;
  const robotsStatus = robotsRes?.status ?? 0;
  const robotsBody = robotsRes?.ok ? await robotsRes.text() : "";
  const robotsAllowsIndex = !/User-agent:\s*\*\s*\n\s*Disallow:\s*\/\s*$/im.test(robotsBody);

  // Sample internal links broken-link check on homepage links
  const candidateLinks = [...new Set(parsedPages.flatMap((p) => p.internalLinks))].slice(0, 12);
  const brokenLinks: string[] = [];
  await Promise.all(
    candidateLinks.map(async (linkPath) => {
      try {
        const res = await timedFetch(
          `${origin}${linkPath}`,
          { method: "HEAD", redirect: "follow" },
          5000,
        );
        if (res.status >= 400) brokenLinks.push(`${linkPath} (HTTP ${res.status})`);
      } catch {
        brokenLinks.push(`${linkPath} (unreachable)`);
      }
    }),
  );

  const issues = evaluateSiteSeoIssues(parsedPages, {
    sitemapStatus,
    robotsStatus,
    robotsAllowsIndex,
  });

  const auditRecords: Array<Omit<SeoAuditRecord, "id">> = parsedPages.map((p) => ({
    url: p.url,
    page_path: p.pagePath,
    status_code: p.statusCode,
    title: p.title,
    meta_description: p.metaDescription,
    canonical_url: p.canonicalUrl,
    robots_meta: p.robotsMeta,
    og_title: p.ogTitle,
    og_description: p.ogDescription,
    og_image: p.ogImage,
    h1_count: p.h1Count,
    h1_text: p.h1Text,
    has_json_ld: p.hasJsonLd,
    json_ld_types: p.jsonLdTypes,
    has_ga4_tag: p.hasGa4Tag,
    ga4_measurement_id: p.ga4MeasurementId,
    broken_links: p.pagePath === "/" ? brokenLinks : [],
    issues: issues.filter((i) => i.pagePath.includes(p.pagePath)).map((i) => ({ ...i })),
    response_ms: p.responseMs,
    checked_at: checkedAt,
  }));

  await saveSeoCrawlResults(
    auditRecords,
    issues.map((i) => ({
      page_path: i.pagePath,
      url: i.url,
      severity: i.severity,
      code: i.code,
      title: i.title,
      explanation: i.explanation,
      suggested_fix: i.suggestedFix,
    })),
  );

  return {
    checkedAt,
    sitemapStatus,
    robotsStatus,
    robotsAllowsIndex,
    brokenLinks,
    audits: await listLatestSeoAudits(),
    issues,
  };
}

// ============================================================================
// Google PageSpeed Insights v5 API
// ============================================================================

export async function runRealPageSpeed(
  targetUrl: string,
  strategy: "mobile" | "desktop",
): Promise<PageSpeedReportRecord> {
  // Google applies a daily quota to the whole Cloud project/API key. Once a 429 is
  // recorded, do not keep spending requests by retrying on every administrator click.
  // Reuse the recorded quota response for 24 hours; no Google request is made in that window.
  const latestReports = await listPageSpeedReports(1);
  const latestReport = latestReports[0];
  const quotaCooldownMs = 24 * 60 * 60 * 1000;
  if (
    latestReport?.error?.includes("PageSpeed API HTTP 429") &&
    Date.now() - new Date(latestReport.created_at).getTime() < quotaCooldownMs
  ) {
    return {
      ...latestReport,
      url: targetUrl,
      strategy,
      error:
        "Google PageSpeed daily quota was exceeded. Further API requests are paused for 24 hours to prevent repeated quota failures. Please retry after the quota resets or review the Google Cloud PageSpeed API quota.",
    };
  }

  const apiKey = getRuntimeSecret("PAGESPEED_API_KEY");
  const params = new URLSearchParams({
    url: targetUrl,
    strategy,
  });
  for (const cat of ["performance", "accessibility", "best-practices", "seo"]) {
    params.append("category", cat);
  }
  if (apiKey) params.set("key", apiKey);

  try {
    const res = await timedFetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
      {},
      45000,
    );
    if (!res.ok) {
      const errBody = await res.text();
      return savePageSpeedReport({
        url: targetUrl,
        strategy,
        performance_score: null,
        accessibility_score: null,
        best_practices_score: null,
        seo_score: null,
        lcp_ms: null,
        inp_ms: null,
        cls_score: null,
        fcp_ms: null,
        ttfb_ms: null,
        field_lcp_ms: null,
        field_inp_ms: null,
        field_cls: null,
        opportunities: [],
        audits: [],
        error: `PageSpeed API HTTP ${res.status}: ${errBody.slice(0, 180)}`,
      });
    }

    const json = (await res.json()) as {
      lighthouseResult?: {
        categories?: Record<string, { score?: number | null; auditRefs?: Array<{ id: string }> }>;
        audits?: Record<
          string,
          {
            id: string;
            title?: string;
            description?: string;
            score?: number | null;
            numericValue?: number;
            displayValue?: string;
            details?: {
              type?: string;
              overallSavingsMs?: number;
              overallSavingsBytes?: number;
            };
          }
        >;
      };
      loadingExperience?: {
        metrics?: Record<string, { percentile?: number }>;
      };
    };

    const cats = json.lighthouseResult?.categories ?? {};
    const auditsMap = json.lighthouseResult?.audits ?? {};
    const pct = (key: string) => {
      const raw = cats[key]?.score;
      return typeof raw === "number" ? Math.round(raw * 100) : null;
    };

    const opportunities = Object.values(auditsMap)
      .filter(
        (a) => a.details?.type === "opportunity" && typeof a.score === "number" && a.score < 0.9,
      )
      .sort((a, b) => (b.details?.overallSavingsMs ?? 0) - (a.details?.overallSavingsMs ?? 0))
      .slice(0, 12)
      .map((a) => ({
        id: a.id,
        title: a.title ?? a.id,
        description: ((a.description ?? "").split("[Learn")[0] ?? "").trim(),
        ...(a.details?.overallSavingsMs !== undefined
          ? { savingsMs: a.details.overallSavingsMs }
          : {}),
        ...(a.details?.overallSavingsBytes !== undefined
          ? { savingsBytes: a.details.overallSavingsBytes }
          : {}),
      }));

    const notableAudits: Array<{
      id: string;
      title: string;
      score: number | null;
      category: string;
      displayValue?: string;
    }> = [];
    for (const catKey of ["accessibility", "best-practices", "seo"] as const) {
      const refs = cats[catKey]?.auditRefs ?? [];
      for (const ref of refs) {
        const a = auditsMap[ref.id];
        if (a && typeof a.score === "number" && a.score < 1) {
          notableAudits.push({
            id: a.id,
            title: a.title ?? a.id,
            score: Math.round(a.score * 100),
            category: catKey,
            ...(a.displayValue !== undefined ? { displayValue: a.displayValue } : {}),
          });
        }
      }
    }

    const crux = json.loadingExperience?.metrics;
    return savePageSpeedReport({
      url: targetUrl,
      strategy,
      performance_score: pct("performance"),
      accessibility_score: pct("accessibility"),
      best_practices_score: pct("best-practices"),
      seo_score: pct("seo"),
      lcp_ms: auditsMap["largest-contentful-paint"]?.numericValue ?? null,
      inp_ms:
        auditsMap["interaction-to-next-paint"]?.numericValue ??
        auditsMap["total-blocking-time"]?.numericValue ??
        null,
      cls_score: auditsMap["cumulative-layout-shift"]?.numericValue ?? null,
      fcp_ms: auditsMap["first-contentful-paint"]?.numericValue ?? null,
      ttfb_ms: auditsMap["server-response-time"]?.numericValue ?? null,
      field_lcp_ms: crux?.["LARGEST_CONTENTFUL_PAINT_MS"]?.percentile ?? null,
      field_inp_ms: crux?.["INTERACTION_TO_NEXT_PAINT"]?.percentile ?? null,
      field_cls: crux?.["CUMULATIVE_LAYOUT_SHIFT_SCORE"]?.percentile ?? null,
      opportunities,
      audits: notableAudits.slice(0, 30),
      error: null,
    });
  } catch (e) {
    return savePageSpeedReport({
      url: targetUrl,
      strategy,
      performance_score: null,
      accessibility_score: null,
      best_practices_score: null,
      seo_score: null,
      lcp_ms: null,
      inp_ms: null,
      cls_score: null,
      fcp_ms: null,
      ttfb_ms: null,
      field_lcp_ms: null,
      field_inp_ms: null,
      field_cls: null,
      opportunities: [],
      audits: [],
      error: e instanceof Error ? e.message : "PageSpeed request timed out",
    });
  }
}

// ============================================================================
// Google Analytics 4 Data API (RS256 JWT + Live Tag Check)
// ============================================================================

async function getGoogleAccessToken(clientEmail: string, privateKeyRaw: string): Promise<string> {
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const nowSec = Math.floor(Date.now() / 1000);
  const claim = Buffer.from(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: nowSec + 3600,
      iat: nowSec,
    }),
  ).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const sig = signer.sign(privateKey, "base64url");
  const jwt = `${header}.${claim}.${sig}`;

  const tokenRes = await timedFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`OAuth token exchange failed (HTTP ${tokenRes.status})`);
  }
  const body = (await tokenRes.json()) as { access_token: string };
  return body.access_token;
}

export async function fetchGa4Analytics(days: 7 | 28 | 90) {
  const propertyId = getRuntimeSecret("GA4_PROPERTY_ID");
  const clientEmail = getRuntimeSecret("GA4_CLIENT_EMAIL");
  const privateKey = getRuntimeSecret("GA4_PRIVATE_KEY");

  // Always check whether the live website actually contains a GA4 measurement tag
  let tagInstalled = false;
  let measurementId: string | null = null;
  try {
    const audits = await listLatestSeoAudits();
    const home = audits.find((a) => a.page_path === "/");
    if (home) {
      tagInstalled = home.has_ga4_tag;
      measurementId = home.ga4_measurement_id;
    } else {
      const r = await timedFetch(LIVE_SITE_URL, {}, 6000);
      if (r.ok) {
        const html = await r.text();
        const m =
          /googletagmanager\.com\/gtag\/js\?id=(G-[A-Z0-9]+)|gtag\(\s*['"]config['"]\s*,\s*['"](G-[A-Z0-9]+)['"]/i.exec(
            html,
          );
        measurementId = m?.[1] ?? m?.[2] ?? null;
        tagInstalled = Boolean(measurementId);
      }
    }
  } catch {
    tagInstalled = false;
  }

  const missing = [
    ...(!propertyId ? ["GA4_PROPERTY_ID"] : []),
    ...(!clientEmail ? ["GA4_CLIENT_EMAIL"] : []),
    ...(!privateKey ? ["GA4_PRIVATE_KEY"] : []),
  ];

  if (missing.length > 0) {
    return {
      configured: false as const,
      tagInstalled,
      measurementId,
      missing,
      fetchedAt: new Date().toISOString(),
    };
  }

  try {
    const accessToken = await getGoogleAccessToken(clientEmail!, privateKey!);
    const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
    const run = async (body: Record<string, unknown>) => {
      const r = await timedFetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`GA4 API HTTP ${r.status}: ${(await r.text()).slice(0, 140)}`);
      return (await r.json()) as {
        rows?: Array<{
          dimensionValues?: Array<{ value: string }>;
          metricValues?: Array<{ value: string }>;
        }>;
      };
    };

    const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];
    const [totals, daily, channels, sources, geo, devices, events] = await Promise.all([
      run({
        dateRanges,
        metrics: [
          { name: "totalUsers" },
          { name: "activeUsers" },
          { name: "newUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "engagementRate" },
          { name: "averageSessionDuration" },
          { name: "conversions" },
        ],
      }),
      run({
        dateRanges,
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
      run({
        dateRanges,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "conversions" }],
        limit: 12,
      }),
      run({
        dateRanges,
        dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }],
        limit: 30,
      }),
      run({
        dateRanges,
        dimensions: [{ name: "country" }, { name: "city" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
        limit: 20,
      }),
      run({
        dateRanges,
        dimensions: [{ name: "deviceCategory" }, { name: "browser" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
        limit: 15,
      }),
      run({
        dateRanges,
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }, { name: "conversions" }],
        limit: 20,
      }),
    ]);

    const tRow = totals.rows?.[0]?.metricValues ?? [];
    const num = (i: number) => Number(tRow[i]?.value ?? 0);

    return {
      configured: true as const,
      tagInstalled,
      measurementId,
      missing: [] as string[],
      fetchedAt: new Date().toISOString(),
      summary: {
        totalUsers: num(0),
        activeUsers: num(1),
        newUsers: num(2),
        returningUsers: Math.max(0, num(1) - num(2)),
        sessions: num(3),
        pageViews: num(4),
        engagementRate: Math.round(num(5) * 1000) / 10,
        avgSessionSeconds: Math.round(num(6)),
        conversions: num(7),
      },
      daily: (daily.rows ?? []).map((r) => ({
        date: r.dimensionValues?.[0]?.value ?? "",
        users: Number(r.metricValues?.[0]?.value ?? 0),
        sessions: Number(r.metricValues?.[1]?.value ?? 0),
        pageViews: Number(r.metricValues?.[2]?.value ?? 0),
      })),
      channels: (channels.rows ?? []).map((r) => ({
        channel: r.dimensionValues?.[0]?.value ?? "(other)",
        sessions: Number(r.metricValues?.[0]?.value ?? 0),
        users: Number(r.metricValues?.[1]?.value ?? 0),
        conversions: Number(r.metricValues?.[2]?.value ?? 0),
      })),
      sources: (sources.rows ?? []).map((r) => ({
        source: r.dimensionValues?.[0]?.value ?? "(direct)",
        medium: r.dimensionValues?.[1]?.value ?? "(none)",
        sessions: Number(r.metricValues?.[0]?.value ?? 0),
        users: Number(r.metricValues?.[1]?.value ?? 0),
      })),
      geo: (geo.rows ?? []).map((r) => ({
        country: r.dimensionValues?.[0]?.value ?? "Unknown",
        city: r.dimensionValues?.[1]?.value ?? "Unknown",
        users: Number(r.metricValues?.[0]?.value ?? 0),
        sessions: Number(r.metricValues?.[1]?.value ?? 0),
      })),
      devices: (devices.rows ?? []).map((r) => ({
        device: r.dimensionValues?.[0]?.value ?? "desktop",
        browser: r.dimensionValues?.[1]?.value ?? "Unknown",
        users: Number(r.metricValues?.[0]?.value ?? 0),
        sessions: Number(r.metricValues?.[1]?.value ?? 0),
      })),
      events: (events.rows ?? []).map((r) => ({
        event: r.dimensionValues?.[0]?.value ?? "",
        count: Number(r.metricValues?.[0]?.value ?? 0),
        conversions: Number(r.metricValues?.[1]?.value ?? 0),
      })),
    };
  } catch (e) {
    return {
      configured: true as const,
      tagInstalled,
      measurementId,
      missing: [] as string[],
      error: e instanceof Error ? e.message : "GA4 query failed",
      fetchedAt: new Date().toISOString(),
    };
  }
}

// ============================================================================
// AI Provider Connector (Gemini / OpenAI) + Evidence-Based Grounded Fallback
// ============================================================================

export async function generateGroundedAiAnalysis(input: {
  prompt: string;
  contextSignals: Record<string, JsonValue | undefined>;
  preferredProvider?: "auto" | "gemini" | "openai";
}): Promise<{
  provider: string;
  usedRealAi: boolean;
  text: string;
  warning?: string;
}> {
  const geminiKey = getRuntimeSecret("GEMINI_API_KEY");
  const openaiKey = getRuntimeSecret("OPENAI_API_KEY");
  const pickGemini =
    input.preferredProvider === "gemini"
      ? Boolean(geminiKey)
      : input.preferredProvider === "openai"
        ? false
        : Boolean(geminiKey);
  const pickOpenai =
    input.preferredProvider === "openai" ? Boolean(openaiKey) : !pickGemini && Boolean(openaiKey);

  const systemPrompt =
    "You are the RYZITE Control Centre technical analyst. Use ONLY the verified JSON telemetry provided. Never invent visitor metrics, scores, or dates not present in the payload. Never publish changes automatically; present recommendations for administrator approval.";

  let providerFailure: string | null = null;

  if (pickGemini && geminiKey) {
    try {
      const res = await timedFetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `${input.prompt}\n\nVerified RYZITE telemetry:\n${JSON.stringify(input.contextSignals, null, 2)}`,
                  },
                ],
              },
            ],
          }),
        },
        20000,
      );
      if (res.ok) {
        const json = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = json.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("\n")
          .trim();
        if (text) return { provider: "Google Gemini (gemini-2.5-flash)", usedRealAi: true, text };
        providerFailure = "Gemini returned an empty response";
      } else {
        providerFailure = `Gemini API HTTP ${res.status}`;
      }
    } catch (e) {
      providerFailure = e instanceof Error ? `Gemini error (${e.name})` : "Gemini request failed";
    }
  }

  if (pickOpenai && openaiKey) {
    try {
      const res = await timedFetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `${input.prompt}\n\nVerified RYZITE telemetry:\n${JSON.stringify(input.contextSignals, null, 2)}`,
              },
            ],
          }),
        },
        20000,
      );
      if (res.ok) {
        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = json.choices?.[0]?.message?.content?.trim();
        if (text) return { provider: "OpenAI (gpt-4o-mini)", usedRealAi: true, text };
        providerFailure = "OpenAI returned an empty response";
      } else {
        providerFailure = `OpenAI API HTTP ${res.status}`;
      }
    } catch (e) {
      providerFailure = e instanceof Error ? `OpenAI error (${e.name})` : "OpenAI request failed";
    }
  }

  return {
    provider: providerFailure
      ? "Rule-based telemetry fallback"
      : "Rule-based diagnostic (no AI provider key configured)",
    usedRealAi: false,
    warning: providerFailure
      ? `${providerFailure}; showing grounded telemetry summary instead.`
      : "Configure GEMINI_API_KEY or OPENAI_API_KEY server-side for generative AI commentary.",
    text: buildRuleBasedSummary(input.contextSignals),
  };
}

function buildRuleBasedSummary(signals: Record<string, JsonValue | undefined>): string {
  const pagesCrawled = Number(signals["pagesCrawled"] ?? 0);
  const openSeo = Number(signals["openSeoErrors"] ?? 0) + Number(signals["openSeoWarnings"] ?? 0);
  const perf = signals["latestMobilePerformance"];
  const siteOk = signals["siteOnline"] === true;
  const pendingEnquiries = Number(signals["pendingEnquiries"] ?? 0);

  const lines = [
    `Live website availability: ${siteOk ? "Online" : "Check needed"}.`,
    pagesCrawled > 0
      ? `Open SEO findings from live crawl (${pagesCrawled} pages): ${openSeo} item(s).`
      : "Live SEO crawl has not been run yet — run a scan in SEO Centre -> Overview.",
    perf !== null && perf !== undefined
      ? `Latest PageSpeed Mobile Performance score: ${perf}/100.`
      : "PageSpeed test has not been run yet — run a live test in Performance -> PageSpeed & Lighthouse.",
    `Pending customer enquiries awaiting review: ${pendingEnquiries}.`,
  ];
  return lines.join(" ");
}

export async function getLatestPerformanceSnapshot() {
  const reports = await listPageSpeedReports(20);
  const mobile = reports.find((r) => r.strategy === "mobile" && !r.error) ?? null;
  const desktop = reports.find((r) => r.strategy === "desktop" && !r.error) ?? null;
  return { mobile, desktop, history: reports };
}
