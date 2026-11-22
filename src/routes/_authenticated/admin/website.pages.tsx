import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileCode2, Image, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader, Panel, EmptyState } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/guard";
import {
  getWebsiteContentFile,
  getWebsiteContentIndex,
} from "@/lib/website-content.functions";
import { createWebsiteContentPullRequest } from "@/lib/website-content-publish.functions";

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
  const [draftContent, setDraftContent] = useState("");
  const [changeTitle, setChangeTitle] = useState("Update website content");
  const [publishResult, setPublishResult] = useState<{ pullRequestUrl: string | null; message: string } | null>(null);
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
  const publishContent = useMutation({
    mutationFn: () => createWebsiteContentPullRequest({ data: { path: selectedPath!, content: draftContent, title: changeTitle } }),
    onSuccess: (result) => setPublishResult(result),
  });

  useEffect(() => {
    if (file.data) {
      setDraftContent(file.data.content);
      setChangeTitle(`Update ${file.data.path.split("/").at(-1) ?? "website content"}`);
      setPublishResult(null);
      publishContent.reset();
    }
  }, [file.data?.sha]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website Management"
        title="Live Website Content"
        description="Edit website source and submit a protected draft pull request. Production changes only after review and merge."
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
          <Badge variant="success"><ShieldCheck className="mr-1 size-3" /> Connected to website source</Badge>
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
          description="Select a source file to review or prepare a proposed update."
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
          actions={selectedPath ? <Badge variant="muted">Draft editor</Badge> : undefined}
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
              <div className="space-y-3">
                <label className="block space-y-1 text-sm font-medium">
                  Pull request title
                  <input value={changeTitle} onChange={(event) => setChangeTitle(event.target.value)} maxLength={120} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </label>
                <label className="block space-y-1 text-sm font-medium">
                  Edit source content
                  <textarea value={draftContent} onChange={(event) => { setDraftContent(event.target.value); setPublishResult(null); }} spellCheck={false} rows={22} className="w-full rounded-xl border bg-secondary/40 p-4 font-mono text-xs leading-relaxed" />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => publishContent.mutate()} disabled={publishContent.isPending || !changeTitle.trim() || !selectedPath || draftContent === file.data.content}>
                    {publishContent.isPending ? "Creating draft PR…" : "Submit for review"}
                  </Button>
                  <Button variant="outline" onClick={() => setDraftContent(file.data.content)} disabled={publishContent.isPending || draftContent === file.data.content}>Discard edits</Button>
                  <span className="text-xs text-muted-foreground">The main branch is never edited directly.</span>
                </div>
                {publishContent.error && <p role="alert" className="text-sm text-destructive">{publishContent.error.message}</p>}
                {publishResult && <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium text-foreground">{publishResult.message}</p>
                  {publishResult.pullRequestUrl && <a className="mt-1 inline-block text-electric underline" href={publishResult.pullRequestUrl} target="_blank" rel="noreferrer">Open draft pull request</a>}
                </div>}
              </div>
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
