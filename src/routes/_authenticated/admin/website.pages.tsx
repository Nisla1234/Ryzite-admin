import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileCode2, Image, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PageHeader, Panel, EmptyState } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/guard";
import {
  getWebsiteContentFile,
  getWebsiteContentIndex,
} from "@/lib/website-content.functions";

export const Route = createFileRoute("/_authenticated/admin/website/pages")({
  beforeLoad: requirePermission("content.edit"),
  head: () => ({
    meta: [
      { title: "Website Content · RYZITE Control Centre" },
      { name: "description", content: "Read the live RYZITE website content directly from its GitHub source repository." },
    ],
  }),
  component: WebsiteContentPage,
});

const LIVE_SITE = "https://ryzite-website.thulirkalcom.workers.dev/";

function WebsiteContentPage() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const fetchIndex = useServerFn(getWebsiteContentIndex);
  const fetchFile = useServerFn(getWebsiteContentFile);
  const index = useQuery({
    queryKey: ["website-content-index"],
    queryFn: () => fetchIndex(),
    staleTime: 60_000,
  });
  const file = useQuery({
    queryKey: ["website-content-file", selectedPath],
    queryFn: () => fetchFile({ data: { path: selectedPath! } }),
    enabled: Boolean(selectedPath),
    staleTime: 60_000,
  });

  const selectedName = selectedPath?.split("/").at(-1);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website Management"
        title="Live Website Content"
        description="Read-only view of the actual source-controlled content used by the RYZITE website. Changes are not made from this screen."
        actions={
          <>
            <Button asChild variant="outline">
              <a href={LIVE_SITE} target="_blank" rel="noreferrer">Open live website</a>
            </Button>
            <Button variant="subtle" onClick={() => index.refetch()} disabled={index.isFetching}>
              <RefreshCw className={index.isFetching ? "animate-spin" : ""} /> Refresh source
            </Button>
          </>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="success"><ShieldCheck className="mr-1 size-3" /> Read-only connection</Badge>
          <span className="text-sm font-medium">Nisla1234/ryzite-unified-platform</span>
          <Badge variant="muted">main</Badge>
          <span className="text-xs text-muted-foreground">GitHub source · not a Sanity dataset</span>
        </div>
        {index.data && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-secondary/60 p-3">
              <p className="text-xs text-muted-foreground">Content source files</p>
              <p className="mt-1 font-display text-2xl">{index.data.contentFiles.length}</p>
            </div>
            <div className="rounded-xl bg-secondary/60 p-3">
              <p className="text-xs text-muted-foreground">Website media assets</p>
              <p className="mt-1 font-display text-2xl">{index.data.mediaFiles.length}</p>
            </div>
            <div className="rounded-xl bg-secondary/60 p-3">
              <p className="text-xs text-muted-foreground">Last checked</p>
              <p className="mt-1 text-sm font-semibold">{new Date(index.data.checkedAt).toLocaleString()}</p>
            </div>
          </div>
        )}
        {index.data?.truncated && (
          <p className="mt-3 text-xs text-warning">GitHub returned a truncated repository tree. The file inventory may be incomplete.</p>
        )}
        {index.error && <p className="mt-3 text-sm text-destructive">{index.error.message}</p>}
        {index.isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading website source inventory…</p>}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.7fr)]">
        <Panel
          title="Content files"
          description="Select a file to inspect its current contents from the main branch."
        >
          {index.data?.contentFiles.length ? (
            <div className="max-h-[620px] space-y-1 overflow-auto">
              {index.data.contentFiles.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  onClick={() => setSelectedPath(entry.path)}
                  className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${selectedPath === entry.path ? "bg-accent text-accent-foreground" : ""}`}
                >
                  <FileCode2 className="mt-0.5 size-4 shrink-0 text-electric" />
                  <span className="min-w-0 flex-1 break-all">{entry.path}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{Math.ceil(entry.size / 1024)} KB</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<FileCode2 />}
              title={index.isLoading ? "Loading files" : "No content files found"}
              description="The source inventory will appear here when the repository responds."
            />
          )}
        </Panel>

        <Panel
          title={selectedName ?? "Content preview"}
          description={selectedPath ?? "Choose a source file from the list"}
          actions={selectedPath ? <Badge variant="muted">Read only</Badge> : undefined}
        >
          {!selectedPath ? (
            <EmptyState
              icon={<FileCode2 />}
              title="Select a content file"
              description="The selected file's exact GitHub content will appear here."
            />
          ) : file.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading {selectedPath}…</p>
          ) : file.error ? (
            <p className="text-sm text-destructive">{file.error.message}</p>
          ) : file.data ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="muted">{file.data.branch}</Badge>
                <span>{file.data.size.toLocaleString()} bytes</span>
                <span>SHA {file.data.sha.slice(0, 10)}</span>
              </div>
              <pre className="max-h-[680px] overflow-auto rounded-xl bg-secondary/70 p-4 text-xs leading-relaxed"><code>{file.data.content}</code></pre>
            </div>
          ) : null}
        </Panel>
      </div>

      <Panel title={<span className="flex items-center gap-2"><Image className="size-4 text-electric" /> Media inventory</span>} description="Image and video assets tracked in the website repository.">
        {index.data?.mediaFiles.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {index.data.mediaFiles.map((asset) => (
              <div key={asset.path} className="rounded-xl border p-3">
                <p className="break-all text-sm font-medium">{asset.path.replace("public/", "/")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{Math.ceil(asset.size / 1024)} KB</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No public/assets media files were returned by the repository inventory.</p>
        )}
      </Panel>
    </div>
  );
}
