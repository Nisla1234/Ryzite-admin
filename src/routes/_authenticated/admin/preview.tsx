import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Eye, Laptop, Smartphone, Tablet } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LIVE_SITE_URL } from "@/lib/nav";
import { getCmsCollection } from "@/lib/platform.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/preview")({
  head: () => ({
    meta: [
      { title: "Live Website Preview · RYZITE Control Centre" },
      {
        name: "description",
        content:
          "See the live RYZITE website on desktop, tablet and mobile alongside draft CMS content.",
      },
    ],
  }),
  component: PreviewPage,
});

const PAGES = [
  { path: "", slug: "/", label: "Home" },
  { path: "about/", slug: "/about/", label: "About" },
  { path: "services/", slug: "/services/", label: "Services" },
  { path: "solutions/", slug: "/solutions/", label: "Solutions" },
  { path: "our-work/", slug: "/our-work/", label: "Our Work" },
  { path: "how-we-work/", slug: "/how-we-work/", label: "How We Work" },
  { path: "packages/", slug: "/packages/", label: "Packages" },
  { path: "articles/", slug: "/articles/", label: "Articles" },
  { path: "contact/", slug: "/contact/", label: "Contact" },
];

const DEVICES = [
  { key: "desktop", label: "Desktop", icon: Laptop, width: "100%" },
  { key: "tablet", label: "Tablet", icon: Tablet, width: "820px" },
  { key: "mobile", label: "Mobile", icon: Smartphone, width: "390px" },
] as const;

function PreviewPage() {
  const [path, setPath] = useState("");
  const [device, setDevice] = useState<(typeof DEVICES)[number]["key"]>("desktop");
  const [mode, setMode] = useState<"live" | "cms">("live");

  const fetchPages = useServerFn(getCmsCollection);
  const pagesQuery = useQuery({
    queryKey: ["cms-collection", "pages"],
    queryFn: () => fetchPages({ data: { docTypes: ["page"] } }),
  });

  const url = LIVE_SITE_URL + path;
  const width = DEVICES.find((d) => d.key === device)?.width ?? "100%";
  const currentPageDef = PAGES.find((p) => p.path === path) ?? PAGES[0]!;
  const cmsDoc = (pagesQuery.data?.documents ?? []).find((d) => d.slug === currentPageDef.slug);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Website Management"
        title="Live Website Preview"
        description="Inspect the live Cloudflare Worker site across Desktop, Tablet, and Mobile, or review staged CMS/SEO content."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "live" | "cms")}>
              <TabsList>
                <TabsTrigger value="live">Live Website</TabsTrigger>
                <TabsTrigger value="cms">Staged CMS & SEO</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button asChild variant="subtle">
              <a href={url} target="_blank" rel="noreferrer">
                Open in new tab <ArrowUpRight />
              </a>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {PAGES.map((p) => (
          <Button
            key={p.path}
            size="sm"
            variant={p.path === path ? "default" : "subtle"}
            onClick={() => setPath(p.path)}
          >
            {p.label}
          </Button>
        ))}
        <div className="ml-auto flex gap-1">
          {DEVICES.map((d) => (
            <Button
              key={d.key}
              size="icon"
              variant={d.key === device ? "default" : "ghost"}
              onClick={() => setDevice(d.key)}
              aria-label={d.label}
            >
              <d.icon />
            </Button>
          ))}
        </div>
      </div>

      {mode === "live" ? (
        <div className="flex justify-center rounded-2xl border bg-muted p-3">
          <iframe
            key={url}
            src={url}
            title="Live RYZITE website"
            style={{ width }}
            className={cn("h-[75vh] max-w-full rounded-xl border bg-card")}
          />
        </div>
      ) : (
        <Panel
          title={cmsDoc ? `${cmsDoc.title} (${cmsDoc.slug})` : currentPageDef.label}
          description="Control Centre staged content and SEO snapshot ready for public consumption via /api/public/content"
          actions={
            cmsDoc ? (
              <Badge variant={cmsDoc.status === "published" ? "success" : "warning"}>
                {cmsDoc.status}
              </Badge>
            ) : undefined
          }
        >
          {cmsDoc ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl bg-secondary/50 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">SEO Meta</p>
                <p className="mt-1 font-semibold">{cmsDoc.seo.seoTitle || cmsDoc.title}</p>
                <p className="mt-1 text-muted-foreground">
                  {cmsDoc.seo.metaDescription || cmsDoc.summary}
                </p>
                <p className="mt-1 font-mono text-xs text-electric">
                  Canonical: {cmsDoc.seo.canonicalUrl || url}
                </p>
              </div>
              <pre className="max-h-96 overflow-auto rounded-xl border bg-secondary/30 p-4 text-xs">
                {JSON.stringify(cmsDoc.payload, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Eye className="size-4" /> Select a core page to inspect its CMS record.
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
