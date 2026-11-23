export interface ParsedPageSeo {
  url: string;
  pagePath: string;
  statusCode: number;
  responseMs: number;
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  robotsMeta: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  h1Count: number;
  h1Text: string;
  hasJsonLd: boolean;
  jsonLdTypes: string[];
  invalidJsonLdCount: number;
  hasGa4Tag: boolean;
  ga4MeasurementId: string | null;
  internalLinks: string[];
}

export interface DetectedSeoIssue {
  pagePath: string;
  url: string;
  severity: "error" | "warning" | "info";
  code: string;
  title: string;
  explanation: string;
  suggestedFix: string;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "));
}

function extractAttr(tag: string, attrName: string): string {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = re.exec(tag);
  return decodeHtmlEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
}

function findMetaContent(html: string, attrKey: "name" | "property", target: string): string {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const lowerTarget = target.toLowerCase();
  for (const tag of tags) {
    const keyVal = extractAttr(tag, attrKey).toLowerCase();
    if (keyVal === lowerTarget) {
      return extractAttr(tag, "content");
    }
  }
  return "";
}

function findCanonicalUrl(html: string): string {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of links) {
    const rel = extractAttr(tag, "rel").toLowerCase().split(/\s+/);
    if (rel.includes("canonical")) {
      return extractAttr(tag, "href");
    }
  }
  return "";
}

export function analyzeHtmlSeo(input: {
  url: string;
  pagePath: string;
  statusCode: number;
  responseMs: number;
  html: string;
  baseOrigin: string;
}): ParsedPageSeo {
  const { url, pagePath, statusCode, responseMs, html, baseOrigin } = input;

  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]) : "";

  const metaDescription = findMetaContent(html, "name", "description");
  const robotsMeta = findMetaContent(html, "name", "robots");
  const canonicalUrl = findCanonicalUrl(html);
  const ogTitle = findMetaContent(html, "property", "og:title");
  const ogDescription = findMetaContent(html, "property", "og:description");
  const ogImage = findMetaContent(html, "property", "og:image");

  const h1Matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  const h1Count = h1Matches.length;
  const h1Text = h1Matches[0]?.[1] ? stripTags(h1Matches[0][1]) : "";

  const ldMatches = [
    ...html.matchAll(
      /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  const jsonLdTypes: string[] = [];
  let invalidJsonLdCount = 0;

  for (const m of ldMatches) {
    try {
      const parsed = JSON.parse((m[1] ?? "").trim()) as
        | { "@type"?: unknown; "@graph"?: Array<{ "@type"?: unknown }> }
        | Array<{ "@type"?: unknown }>;
      const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.["@graph"])
          ? parsed["@graph"]
          : [parsed];
      for (const item of items) {
        const t = item?.["@type"];
        if (typeof t === "string" && t) jsonLdTypes.push(t);
        else if (Array.isArray(t)) {
          for (const entry of t) {
            if (typeof entry === "string" && entry) jsonLdTypes.push(entry);
          }
        }
      }
    } catch {
      invalidJsonLdCount += 1;
    }
  }

  const gaMatch =
    /googletagmanager\.com\/gtag\/js\?id=(G-[A-Z0-9]+)|gtag\(\s*['"]config['"]\s*,\s*['"](G-[A-Z0-9]+)['"]/i.exec(
      html,
    );
  const ga4MeasurementId = gaMatch?.[1] ?? gaMatch?.[2] ?? null;

  const anchorMatches = [...html.matchAll(/<a\b[^>]*>/gi)];
  const linksSet = new Set<string>();
  for (const m of anchorMatches) {
    const href = extractAttr(m[0], "href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }
    try {
      const resolved = new URL(href, url);
      if (resolved.origin === baseOrigin && !resolved.pathname.startsWith("/_astro")) {
        linksSet.add(resolved.pathname);
      }
    } catch {
      // Ignore malformed URIs
    }
  }

  return {
    url,
    pagePath,
    statusCode,
    responseMs,
    title,
    metaDescription,
    canonicalUrl,
    robotsMeta,
    ogTitle,
    ogDescription,
    ogImage,
    h1Count,
    h1Text,
    hasJsonLd: ldMatches.length > 0 && invalidJsonLdCount === 0,
    jsonLdTypes,
    invalidJsonLdCount,
    hasGa4Tag: Boolean(ga4MeasurementId),
    ga4MeasurementId,
    internalLinks: [...linksSet].slice(0, 40),
  };
}

export function evaluateSiteSeoIssues(
  pages: ParsedPageSeo[],
  extras: { sitemapStatus: number; robotsStatus: number; robotsAllowsIndex: boolean },
): DetectedSeoIssue[] {
  const issues: DetectedSeoIssue[] = [];
  const origin = pages[0]
    ? new URL(pages[0].url).origin
    : "https://ryzite-website.thulirkalcom.workers.dev";

  if (extras.sitemapStatus !== 200) {
    issues.push({
      pagePath: "/sitemap.xml",
      url: `${origin}/sitemap.xml`,
      severity: "error",
      code: "MISSING_SITEMAP",
      title: "sitemap.xml returns HTTP " + extras.sitemapStatus,
      explanation:
        "Search engines rely on /sitemap.xml to discover published pages, services, solutions, and articles.",
      suggestedFix:
        "Add src/pages/sitemap.xml.ts in the Astro site or serve the generated XML sitemap from published pages.",
    });
  }

  if (extras.robotsStatus !== 200) {
    issues.push({
      pagePath: "/robots.txt",
      url: `${origin}/robots.txt`,
      severity: "warning",
      code: "MISSING_ROBOTS",
      title: "robots.txt returned HTTP " + extras.robotsStatus,
      explanation: "A valid robots.txt declares crawl directives and references sitemap.xml.",
      suggestedFix:
        "Serve /robots.txt allowing public routes and pointing Sitemap to /sitemap.xml.",
    });
  } else if (!extras.robotsAllowsIndex) {
    issues.push({
      pagePath: "/robots.txt",
      url: `${origin}/robots.txt`,
      severity: "error",
      code: "ROBOTS_BLOCKING",
      title: "robots.txt blocks search engine indexing",
      explanation: "Found Disallow: / directive on root user-agent.",
      suggestedFix: "Update robots.txt to Disallow only /admin and /api endpoints.",
    });
  }

  // Detect duplicate titles across HTTP 200 pages
  const titleCounts = new Map<string, ParsedPageSeo[]>();
  for (const p of pages) {
    if (p.statusCode >= 200 && p.statusCode < 300 && p.title) {
      const key = p.title.trim().toLowerCase();
      titleCounts.set(key, [...(titleCounts.get(key) ?? []), p]);
    }
  }
  for (const [, group] of titleCounts) {
    const first = group[0];
    if (group.length > 1 && first) {
      issues.push({
        pagePath: group.map((g) => g.pagePath).join(", "),
        url: first.url,
        severity: "error",
        code: "DUPLICATE_TITLES",
        title: `Duplicate <title> "${first.title}" across ${group.length} pages`,
        explanation:
          "Multiple pages render the exact same browser title instead of unique page-specific titles.",
        suggestedFix:
          "Update MainLayout.astro to render <title>{title}</title> and supply unique titles per route.",
      });
    }
  }

  const anyGa4 = pages.some((p) => p.hasGa4Tag);
  if (!anyGa4 && pages.length > 0) {
    issues.push({
      pagePath: "/",
      url: `${origin}/`,
      severity: "warning",
      code: "MISSING_GA4_TAG",
      title: "No Google Analytics 4 measurement tag detected",
      explanation:
        "Real visitor tracking in GA4 requires the gtag.js measurement script (G-...) in the website head.",
      suggestedFix: "Configure GA4 Measurement ID and inject gtag.js in MainLayout.astro.",
    });
  }

  for (const p of pages) {
    if (p.statusCode >= 400 || p.statusCode === 0) {
      issues.push({
        pagePath: p.pagePath,
        url: p.url,
        severity: "error",
        code: "PAGE_HTTP_ERROR",
        title: `${p.pagePath} returned HTTP ${p.statusCode || "unreachable"}`,
        explanation: "A core route failed to return a healthy HTTP 2xx response.",
        suggestedFix: "Inspect Astro route handler and Cloudflare deployment logs.",
      });
      continue;
    }

    if (!p.title || p.title.length < 15) {
      issues.push({
        pagePath: p.pagePath,
        url: p.url,
        severity: "warning",
        code: "SHORT_OR_MISSING_TITLE",
        title: `Title too short or missing on ${p.pagePath}`,
        explanation: `Current title is "${p.title || "(empty)"}" (${p.title.length} chars). Aim for 30-60 descriptive characters.`,
        suggestedFix: "Write a descriptive page title including primary topic and RYZITE brand.",
      });
    }

    if (!p.metaDescription || p.metaDescription.length < 50) {
      issues.push({
        pagePath: p.pagePath,
        url: p.url,
        severity: "warning",
        code: "MISSING_META_DESCRIPTION",
        title: `Meta description missing or short on ${p.pagePath}`,
        explanation: `Current meta description length is ${p.metaDescription.length} characters.`,
        suggestedFix: "Add a concise 120-155 character summary in the page SEO manager.",
      });
    }

    if (!p.canonicalUrl) {
      issues.push({
        pagePath: p.pagePath,
        url: p.url,
        severity: "warning",
        code: "MISSING_CANONICAL",
        title: `Missing canonical URL tag on ${p.pagePath}`,
        explanation:
          'Explicit <link rel="canonical"> prevents duplicate URL indexing across query variants.',
        suggestedFix: `Set canonical URL to ${origin}${p.pagePath}.`,
      });
    }

    if (!p.ogTitle || !p.ogDescription) {
      issues.push({
        pagePath: p.pagePath,
        url: p.url,
        severity: "warning",
        code: "MISSING_OPEN_GRAPH",
        title: `Open Graph social tags incomplete on ${p.pagePath}`,
        explanation:
          "Social platforms use og:title, og:description, and og:image when links are shared.",
        suggestedFix:
          "Enable Open Graph metadata on MainLayout and configure page social preview image.",
      });
    }

    if (p.invalidJsonLdCount > 0) {
      issues.push({
        pagePath: p.pagePath,
        url: p.url,
        severity: "error",
        code: "INVALID_JSON_LD",
        title: `Invalid JSON-LD structured data on ${p.pagePath}`,
        explanation: "Malformed JSON-LD prevents rich search results.",
        suggestedFix: "Validate JSON-LD syntax in Technical SEO & Schema before publishing.",
      });
    } else if (!p.hasJsonLd && p.pagePath === "/") {
      issues.push({
        pagePath: p.pagePath,
        url: p.url,
        severity: "info",
        code: "MISSING_JSON_LD",
        title: "No Schema.org JSON-LD detected on homepage",
        explanation:
          "Adding Organization and WebSite JSON-LD clarifies brand entity signals for search.",
        suggestedFix:
          "Generate and attach Organization + WebSite JSON-LD via Technical SEO & Schema.",
      });
    }

    if (p.h1Count === 0) {
      issues.push({
        pagePath: p.pagePath,
        url: p.url,
        severity: "warning",
        code: "MISSING_H1",
        title: `No <h1> heading found on ${p.pagePath}`,
        explanation: "Each page should expose one clear primary H1 heading.",
        suggestedFix: "Ensure the hero headline uses a semantic <h1> element.",
      });
    } else if (p.h1Count > 1) {
      issues.push({
        pagePath: p.pagePath,
        url: p.url,
        severity: "info",
        code: "MULTIPLE_H1",
        title: `${p.h1Count} <h1> headings found on ${p.pagePath}`,
        explanation: "Prefer a single <h1> per page for unambiguous semantic hierarchy.",
        suggestedFix: "Convert secondary <h1> elements to <h2>.",
      });
    }
  }

  return issues;
}

export function generateSitemapXml(
  baseUrl: string,
  entries: Array<{ path: string; lastmod?: string; changefreq?: string; priority?: string }>,
): string {
  const origin = baseUrl.replace(/\/+$/, "");
  const unique = new Map<
    string,
    { path: string; lastmod?: string; changefreq?: string; priority?: string }
  >();
  for (const e of entries) {
    const cleanPath = e.path.startsWith("/") ? e.path : `/${e.path}`;
    if (!unique.has(cleanPath)) unique.set(cleanPath, { ...e, path: cleanPath });
  }

  const urls = [...unique.values()]
    .map((e) => {
      const loc = `${origin}${e.path}`;
      const lastmod = e.lastmod ? `\n    <lastmod>${e.lastmod.slice(0, 10)}</lastmod>` : "";
      const changefreq = e.changefreq ? `\n    <changefreq>${e.changefreq}</changefreq>` : "";
      const priority = e.priority ? `\n    <priority>${e.priority}</priority>` : "";
      return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmod}${changefreq}${priority}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function generateRobotsTxt(
  baseUrl: string,
  disallowPaths: string[] = ["/admin", "/api"],
): string {
  const origin = baseUrl.replace(/\/+$/, "");
  const disallows = disallowPaths.map((p) => `Disallow: ${p}`).join("\n");
  return `User-agent: *\nAllow: /\n${disallows}\n\nSitemap: ${origin}/sitemap.xml\n`;
}

function escapeXml(val: string): string {
  return val
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
