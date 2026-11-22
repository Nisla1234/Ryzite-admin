import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, Laptop, Smartphone, Tablet } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { LIVE_SITE_URL } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/preview")({
  head: () => ({ meta: [{ title: "Live Website Preview · RYZITE Control Centre" }, { name: "description", content: "See the live RYZITE website on desktop, tablet and mobile." }] }),
  component: PreviewPage,
});

const PAGES = [
  { path: "", label: "Home" },
  { path: "about/", label: "About" },
  { path: "services/", label: "Services" },
  { path: "solutions/", label: "Solutions" },
  { path: "our-work/", label: "Our Work" },
  { path: "how-we-work/", label: "How We Work" },
  { path: "packages/", label: "Packages" },
  { path: "articles/", label: "Articles" },
  { path: "contact/", label: "Contact" },
];

const DEVICES = [
  { key: "desktop", label: "Desktop", icon: Laptop, width: "100%" },
  { key: "tablet", label: "Tablet", icon: Tablet, width: "820px" },
  { key: "mobile", label: "Mobile", icon: Smartphone, width: "390px" },
] as const;

function PreviewPage() {
  const [path, setPath] = useState("");
  const [device, setDevice] = useState<(typeof DEVICES)[number]["key"]>("desktop");
  const url = LIVE_SITE_URL + path;
  const width = DEVICES.find((d) => d.key === device)?.width ?? "100%";
  return (
    <div>
      <PageHeader
        eyebrow="Website Management"
        title="Live Website Preview"
        description="This is the real public website as visitors see it right now. Draft previews arrive with content editing."
        actions={<Button asChild variant="subtle"><a href={url} target="_blank" rel="noreferrer">Open in new tab <ArrowUpRight /></a></Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PAGES.map((p) => (
          <Button key={p.path} size="sm" variant={p.path === path ? "default" : "subtle"} onClick={() => setPath(p.path)}>{p.label}</Button>
        ))}
        <div className="ml-auto flex gap-1">
          {DEVICES.map((d) => (
            <Button key={d.key} size="icon" variant={d.key === device ? "default" : "ghost"} onClick={() => setDevice(d.key)} aria-label={d.label}><d.icon /></Button>
          ))}
        </div>
      </div>
      <div className="flex justify-center rounded-2xl border bg-muted p-3">
        <iframe key={url} src={url} title="Live RYZITE website" style={{ width }} className={cn("h-[75vh] max-w-full rounded-xl border bg-card")} />
      </div>
    </div>
  );
}
