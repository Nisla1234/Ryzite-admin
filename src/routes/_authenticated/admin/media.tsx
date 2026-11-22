import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Copy, ExternalLink, File, Film, Grid2X2, Image as ImageIcon, List,
  Loader2, RefreshCw, Search, Upload, Link2, FolderOpen, HardDrive,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermission } from "@/lib/guard";
import { listLiveWebsiteMedia } from "@/lib/media.functions";

export const Route = createFileRoute("/_authenticated/admin/media")({
  beforeLoad: requirePermission("media.manage"),
  head: () => ({ meta: [{ title: "Media Library · RYZITE Control Centre" }, { name: "description", content: "Browse the exact media assets used by the live RYZITE website." }] }),
  component: MediaLibrary,
});

type Kind = "all" | "image" | "video" | "document" | "other";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaLibrary() {
  const loadMedia = useServerFn(listLiveWebsiteMedia);
  const query = useQuery({
    queryKey: ["live-website-media"],
    queryFn: () => loadMedia(),
    staleTime: 60_000,
  });
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("image");
  const [folder, setFolder] = useState("all");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<string | null>(null);

  const files = query.data?.files ?? [];
  const folders = useMemo(() => [...new Set(files.map((file) => file.folder))].sort(), [files]);
  const counts = useMemo(() => ({
    all: files.length,
    image: files.filter((f) => f.kind === "image").length,
    video: files.filter((f) => f.kind === "video").length,
    document: files.filter((f) => f.kind === "document").length,
    other: files.filter((f) => f.kind === "other").length,
  }), [files]);
  const visible = useMemo(() => files.filter((file) => {
    const matchesKind = kind === "all" || file.kind === kind;
    const matchesFolder = folder === "all" || file.folder === folder;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || file.name.toLowerCase().includes(q) || file.path.toLowerCase().includes(q);
    return matchesKind && matchesFolder && matchesSearch;
  }), [files, kind, folder, search]);
  const active = files.find((file) => file.id === selected) ?? null;

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Media URL copied");
    } catch {
      toast.error("Could not copy the URL. Open the file and copy it from the address bar.");
    }
  }

  const filters: { key: Kind; label: string; icon: typeof ImageIcon }[] = [
    { key: "all", label: "All media", icon: FolderOpen },
    { key: "image", label: "Images", icon: ImageIcon },
    { key: "video", label: "Videos", icon: Film },
    { key: "document", label: "Documents", icon: File },
    { key: "other", label: "Other", icon: File },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website Management"
        title="Media Library"
        description="Browse the original image, video and document files used by the live RYZITE website. This inventory reads directly from the website's GitHub repository."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="subtle" onClick={() => query.refetch()} disabled={query.isFetching}>
              {query.isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
            </Button>
            <Button disabled title="Uploads will be enabled after the approved Sanity or R2 media-write connection is configured.">
              <Upload /> Upload media
            </Button>
            <Button variant="outline" disabled title="External media import will be enabled with the media-write connection.">
              <Link2 /> Add from URL
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Website media files" value={query.data ? String(counts.all) : "—"} icon={HardDrive} />
        <Stat label="Images" value={query.data ? String(counts.image) : "—"} icon={ImageIcon} />
        <Stat label="Videos" value={query.data ? String(counts.video) : "—"} icon={Film} />
        <Stat label="Documents" value={query.data ? String(counts.document) : "—"} icon={File} />
      </div>

      {query.isLoading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}</div>}
      {query.error && <Panel><p className="text-sm text-destructive">{query.error.message}</p><Button className="mt-3" variant="subtle" onClick={() => query.refetch()}>Try again</Button></Panel>}

      {query.data && (
        <>
          <Panel>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search filename or folder…" className="pl-9" />
                </div>
                <select value={folder} onChange={(e) => setFolder(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
                  <option value="all">All folders</option>
                  {folders.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <div className="flex gap-1 rounded-lg border p-1">
                  <Button size="icon" variant={layout === "grid" ? "secondary" : "ghost"} onClick={() => setLayout("grid")} aria-label="Grid view"><Grid2X2 /></Button>
                  <Button size="icon" variant={layout === "list" ? "secondary" : "ghost"} onClick={() => setLayout("list")} aria-label="List view"><List /></Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {filters.map((filter) => {
                  const Icon = filter.icon;
                  return <Button key={filter.key} size="sm" variant={kind === filter.key ? "default" : "outline"} onClick={() => setKind(filter.key)}><Icon /> {filter.label} <Badge variant="muted">{counts[filter.key]}</Badge></Button>;
                })}
              </div>
            </div>
          </Panel>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing {visible.length} of {files.length} website assets</span>
            <span>Source: {query.data.source} · {query.data.branch}</span>
          </div>

          {visible.length === 0 ? (
            <Panel><p className="py-8 text-center text-sm text-muted-foreground">No media matches these filters.</p></Panel>
          ) : (
            <div className={layout === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "space-y-2"}>
              {visible.map((file) => (
                <button key={file.id} type="button" onClick={() => setSelected(file.id)} className={layout === "grid"
                  ? "group overflow-hidden rounded-xl border bg-card text-left transition hover:border-primary/50 hover:shadow-md"
                  : "flex w-full items-center gap-4 rounded-xl border bg-card p-3 text-left transition hover:border-primary/50"}>
                  <div className={layout === "grid" ? "flex aspect-[16/10] items-center justify-center overflow-hidden bg-muted" : "flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted"}>
                    {file.kind === "image" ? <img src={file.url} alt={file.name} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : file.kind === "video" ? <Film className="size-10 text-muted-foreground" /> : <File className="size-10 text-muted-foreground" />}
                  </div>
                  <div className={layout === "grid" ? "min-w-0 space-y-1.5 p-3" : "min-w-0 flex-1"}>
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{file.folder}</p>
                    <div className="flex items-center gap-2"><Badge variant="muted">{file.extension}</Badge><span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span></div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {query.data.truncated && <p className="text-xs text-warning">GitHub marked its repository tree as truncated. Some media files may be missing from this listing.</p>}
          <p className="text-xs text-muted-foreground">Last refreshed {new Date(query.data.checkedAt).toLocaleString()} · Existing website files are read-only here. Upload, replacement and deletion will be enabled only after a secure media storage connection is configured.</p>
        </>
      )}

      {active && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="presentation" onClick={() => setSelected(null)}>
          <section role="dialog" aria-modal="true" aria-label="Media details" onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl border bg-background p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0"><h2 className="truncate text-lg font-semibold">{active.name}</h2><p className="text-xs text-muted-foreground">{active.path}</p></div>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Close</Button>
            </div>
            <div className="mb-4 flex max-h-80 items-center justify-center overflow-hidden rounded-xl bg-muted p-3">
              {active.kind === "image" ? <img src={active.url} alt={active.name} className="max-h-72 max-w-full object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : active.kind === "video" ? <video src={active.url} controls className="max-h-72 max-w-full" /> : <File className="size-16 text-muted-foreground" />}
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <Detail label="Folder" value={active.folder} />
              <Detail label="File type" value={active.extension} />
              <Detail label="File size" value={formatBytes(active.size)} />
              <Detail label="Source repository" value="ryzite-unified-platform / main" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => copyUrl(active.url)}><Copy /> Copy live URL</Button>
              <Button variant="outline" onClick={() => window.open(active.url, "_blank", "noopener,noreferrer")}><ExternalLink /> Open live file</Button>
              <Button variant="outline" disabled title="Replace requires a configured media-write connection.">Replace</Button>
              <Button variant="destructive" disabled title="Delete is disabled to protect files currently used by the live website.">Delete</Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ImageIcon }) {
  return <Panel><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></div><div className="rounded-xl bg-accent p-3 text-electric"><Icon className="size-5" /></div></div></Panel>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-all font-medium">{value}</p></div>;
}
