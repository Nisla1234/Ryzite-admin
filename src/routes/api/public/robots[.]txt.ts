import { createFileRoute } from "@tanstack/react-router";
import { LIVE_SITE_URL } from "@/lib/nav";
import { getPlatformSettings } from "@/lib/platform-db.server";
import { generateRobotsTxt } from "@/lib/seo-analyzer";

export const Route = createFileRoute("/api/public/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const settings = await getPlatformSettings();
        const origin = (settings.liveSiteUrl || LIVE_SITE_URL).replace(/\/+$/, "");
        return new Response(generateRobotsTxt(origin), {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=300",
            "access-control-allow-origin": "*",
          },
        });
      },
    },
  },
});
