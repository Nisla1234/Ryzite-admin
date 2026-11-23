import { createFileRoute } from "@tanstack/react-router";
import { LIVE_SITE_URL } from "@/lib/nav";
import { getPlatformSettings, listCmsDocuments } from "@/lib/platform-db.server";
import { generateSitemapXml } from "@/lib/seo-analyzer";

export const Route = createFileRoute("/api/public/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [docs, settings] = await Promise.all([
          listCmsDocuments({ status: "published" }),
          getPlatformSettings(),
        ]);
        const origin = (settings.liveSiteUrl || LIVE_SITE_URL).replace(/\/+$/, "");
        const entries = docs
          .filter((d) =>
            ["page", "service", "solution", "article", "portfolio"].includes(d.doc_type),
          )
          .map((d) => ({
            path:
              d.doc_type === "page"
                ? d.slug
                : d.doc_type === "service"
                  ? `/services/${d.slug}/`
                  : d.doc_type === "solution"
                    ? `/solutions/${d.slug}/`
                    : d.doc_type === "article"
                      ? `/articles/${d.slug}/`
                      : `/our-work/${d.slug}/`,
            lastmod: d.updated_at,
            priority: d.slug === "/" ? "1.0" : d.doc_type === "page" ? "0.8" : "0.7",
          }));

        return new Response(generateSitemapXml(origin, entries), {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=300",
            "access-control-allow-origin": "*",
          },
        });
      },
    },
  },
});
