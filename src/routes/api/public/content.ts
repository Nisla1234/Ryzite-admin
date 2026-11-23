import { createFileRoute } from "@tanstack/react-router";
import { getPlatformSettings, listCmsDocuments } from "@/lib/platform-db.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=60",
};

export const Route = createFileRoute("/api/public/content")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const typeParam = url.searchParams.get("type");
        const slugParam = url.searchParams.get("slug");

        const [docs, settings] = await Promise.all([
          listCmsDocuments({ status: "published" }),
          getPlatformSettings(),
        ]);

        const filtered = docs
          .filter(
            (d) => (!typeParam || d.doc_type === typeParam) && (!slugParam || d.slug === slugParam),
          )
          .map((d) => ({
            id: d.id,
            docType: d.doc_type,
            slug: d.slug,
            title: d.title,
            summary: d.summary,
            category: d.category,
            sortOrder: d.sort_order,
            payload: d.payload,
            seo: d.seo,
            publishedAt: d.published_at,
            updatedAt: d.updated_at,
          }));

        return Response.json(
          {
            ok: true,
            generatedAt: new Date().toISOString(),
            seoDefaults: {
              titleSuffix: settings.defaultSeoTitleSuffix,
              defaultOgImage: settings.defaultOgImage,
              defaultRobots: settings.defaultRobotsDirective,
            },
            count: filtered.length,
            documents: filtered,
          },
          { headers: CORS_HEADERS },
        );
      },
    },
  },
});
