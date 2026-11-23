import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Image as ImageIcon, Pencil, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteMediaAssetFn,
  getMediaLibraryFn,
  updateMediaMetaFn,
  uploadMediaAssetFn,
} from "@/lib/platform.functions";
import type { MediaAssetRecord } from "@/lib/platform-db.server";

function MediaThumb({ asset }: { asset: MediaAssetRecord }) {
  const [broken, setBroken] = useState(false);
  const src = asset.data_url || asset.url;
  if (broken || !src) {
    return (
      <div className="flex h-40 w-full flex-col items-center justify-center gap-1 rounded-t-xl bg-muted text-xs text-muted-foreground">
        <ImageIcon className="size-6 opacity-60" />
        <span>Preview unavailable</span>
      </div>
    );
  }
  return (
    <div className="relative h-40 w-full overflow-hidden rounded-t-xl bg-secondary/60">
      <img
        src={src}
        alt={asset.alt_text || asset.filename}
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-full w-full object-contain p-2 transition-transform duration-200 hover:scale-105"
      />
    </div>
  );
}

export function MediaLibraryModule() {
  const qc = useQueryClient();
  const fetchMedia = useServerFn(getMediaLibraryFn);
  const uploadFn = useServerFn(uploadMediaAssetFn);
  const updateFn = useServerFn(updateMediaMetaFn);
  const deleteFn = useServerFn(deleteMediaAssetFn);

  const [sourceTab, setSourceTab] = useState<"all" | "github" | "sanity" | "d1">("all");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<MediaAssetRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaAssetRecord | null>(null);

  // Upload form
  const [fileInfo, setFileInfo] = useState<{
    filename: string;
    mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";
    base64Data: string;
  } | null>(null);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [folder, setFolder] = useState("uploads");

  // Edit metadata form
  const [editAlt, setEditAlt] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [editFolder, setEditFolder] = useState("general");

  const mediaQuery = useQuery({
    queryKey: ["media-library"],
    queryFn: () => fetchMedia(),
  });

  const assets = useMemo(() => {
    const list = mediaQuery.data?.assets ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((a) => {
      if (sourceTab !== "all" && a.source !== sourceTab) return false;
      if (!q) return true;
      return (
        a.filename.toLowerCase().includes(q) ||
        a.folder.toLowerCase().includes(q) ||
        a.alt_text.toLowerCase().includes(q)
      );
    });
  }, [mediaQuery.data, sourceTab, search]);

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!fileInfo) throw new Error("Choose an image file first.");
      return uploadFn({
        data: {
          ...fileInfo,
          altText,
          caption,
          folder,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(
        res.storedIn === "sanity"
          ? "Uploaded to Sanity CMS media assets."
          : "Uploaded to Control Centre D1 media storage.",
      );
      if (res.note) toast.message(res.note);
      setUploadOpen(false);
      setFileInfo(null);
      setAltText("");
      setCaption("");
      void qc.invalidateQueries({ queryKey: ["media-library"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("No asset selected");
      return updateFn({
        data: {
          assetKey: editing.asset_key,
          source: editing.source,
          url: editing.url,
          filename: editing.filename,
          altText: editAlt,
          caption: editCaption,
          folder: editFolder,
        },
      });
    },
    onSuccess: () => {
      toast.success("Media metadata updated.");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["media-library"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (assetKey: string) => deleteFn({ data: { assetKey } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error || "Cannot delete this asset.");
        return;
      }
      toast.success("Media asset deleted.");
      setDeleteTarget(null);
      void qc.invalidateQueries({ queryKey: ["media-library"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  function onFileSelect(file: File | undefined) {
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
    const mime = allowed.find((m) => m === file.type);
    if (!mime) {
      toast.error("Unsupported format. Use PNG, JPEG, WEBP, or SVG.");
      return;
    }
    if (file.size > 3_000_000) {
      toast.error("Please upload images under 3 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.split(",")[1] ?? "";
      setFileInfo({ filename: file.name, mimeType: mime, base64Data: base64 });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website Management"
        title="Media Library"
        description="Unified inventory of RYZITE website images from GitHub, Sanity CMS assets, and Control Centre uploads."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void mediaQuery.refetch()}
              disabled={mediaQuery.isFetching}
            >
              <RefreshCw className={mediaQuery.isFetching ? "animate-spin" : undefined} />
              Refresh
            </Button>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload /> Upload image
            </Button>
          </div>
        }
      />

      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={sourceTab} onValueChange={(v) => setSourceTab(v as typeof sourceTab)}>
            <TabsList>
              <TabsTrigger value="all">All ({mediaQuery.data?.assets.length ?? 0})</TabsTrigger>
              <TabsTrigger value="github">
                Website Repo (
                {mediaQuery.data?.assets.filter((a) => a.source === "github").length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="sanity">
                Sanity ({mediaQuery.data?.assets.filter((a) => a.source === "sanity").length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="d1">
                Uploads ({mediaQuery.data?.assets.filter((a) => a.source === "d1").length ?? 0})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search filename, folder, alt text…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant={mediaQuery.data?.sanityStatus.reachable ? "success" : "muted"}>
            Sanity {mediaQuery.data?.sanityStatus.reachable ? "Reachable" : "Checking"}
          </Badge>
          <Badge variant={mediaQuery.data?.sanityStatus.hasWriteToken ? "info" : "muted"}>
            {mediaQuery.data?.sanityStatus.hasWriteToken
              ? "Direct Sanity upload enabled"
              : "D1 upload storage (SANITY_API_TOKEN optional)"}
          </Badge>
        </div>
      </Panel>

      {assets.length === 0 && !mediaQuery.isLoading ? (
        <Panel>
          <EmptyState
            icon={<ImageIcon />}
            title="No matching images"
            description="Adjust your filter or upload a new website image."
          />
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((asset) => (
            <div
              key={asset.asset_key}
              className="flex flex-col rounded-xl border bg-card shadow-card"
            >
              <MediaThumb asset={asset} />
              <div className="flex flex-1 flex-col gap-2 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold" title={asset.filename}>
                    {asset.filename}
                  </p>
                  <Badge variant="muted" className="shrink-0 uppercase">
                    {asset.source}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {asset.alt_text || "No alt text set"}
                </p>
                <div className="mt-auto flex items-center justify-between border-t pt-2.5 text-xs text-muted-foreground">
                  <span>
                    {asset.folder}
                    {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label="Copy asset URL"
                      onClick={() => {
                        void navigator.clipboard.writeText(asset.url);
                        toast.success("Copied URL to clipboard");
                      }}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label="Edit metadata"
                      onClick={() => {
                        setEditing(asset);
                        setEditAlt(asset.alt_text);
                        setEditCaption(asset.caption);
                        setEditFolder(asset.folder);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    {asset.source !== "github" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive hover:text-destructive"
                        aria-label="Delete asset"
                        onClick={() => setDeleteTarget(asset)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload image asset</DialogTitle>
            <DialogDescription>
              Uploads directly to Sanity CMS when SANITY_API_TOKEN is set, or to Control Centre D1
              media storage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="media-file">Image file (PNG, JPG, WEBP, SVG under 3 MB)</Label>
              <Input
                id="media-file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => onFileSelect(e.target.files?.[0])}
              />
              {fileInfo && (
                <p className="text-xs text-muted-foreground">Ready: {fileInfo.filename}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="media-alt">Alt text</Label>
              <Input
                id="media-alt"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Descriptive text for accessibility & SEO"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="media-folder">Folder</Label>
                <Input
                  id="media-folder"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="media-caption">Caption</Label>
                <Input
                  id="media-caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!fileInfo || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
            >
              {uploadMutation.isPending ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Metadata Dialog */}
      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit image metadata</DialogTitle>
            <DialogDescription>{editing?.filename}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-alt">Alt text</Label>
              <Input id="edit-alt" value={editAlt} onChange={(e) => setEditAlt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-caption">Caption</Label>
              <Input
                id="edit-caption"
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-folder">Folder</Label>
              <Input
                id="edit-folder"
                value={editFolder}
                onChange={(e) => setEditFolder(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              {updateMutation.isPending ? "Saving…" : "Save metadata"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete media asset?</DialogTitle>
            <DialogDescription>
              Control Centre checks CMS references before removing {deleteTarget?.filename}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.asset_key)}
            >
              {deleteMutation.isPending ? "Checking…" : "Confirm delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
