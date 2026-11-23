import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Lightbulb,
  RefreshCw,
  Save,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/hooks/use-me";
import { fmtRelative } from "@/lib/format";
import { LIVE_SITE_URL } from "@/lib/nav";
import { can } from "@/lib/permissions";
import {
  generateAiReportFn,
  getAiWorkspaceFn,
  getSeoCentreFn,
  runSeoCrawlFn,
  saveCmsDocumentFn,
  updateSeoIssueStatusFn,
} from "@/lib/platform.functions";
import type { CmsDocumentRecord } from "@/lib/platform-db.server";

export type SeoSection =
  "overview" | "pages" | "social" | "technical" | "suggestions" | "issues" | "sitemap";

const HEADERS: Record<SeoSection, { title: string; description: string }> = {
  overview: {
    title: "SEO Overview",
    description:
      "Real HTTP crawl across all live RYZITE pages separating technical errors from warnings.",
  },
  pages: {
    title: "Page SEO Manager",
    description:
      "Inspect crawled page titles, edit CMS meta overrides, and preview Google search snippets.",
  },
  social: {
    title: "Social & Open Graph",
    description: "Manage Open Graph share titles, descriptions, and social preview images.",
  },
  technical: {
    title: "Technical SEO & Schema",
    description:
      "Inspect H1 headings, duplicate titles, broken links, canonical URLs, and JSON-LD structured data.",
  },
  suggestions: {
    title: "AI SEO Recommendations",
    description:
      "Grounded SEO improvement suggestions — review and apply to draft only; never auto-published.",
  },
  issues: {
    title: "SEO Issues & Corrections",
    description: "Tracked crawl errors and warnings with severity, resolution status, and fixes.",
  },
  sitemap: {
    title: "Sitemap & Robots.txt",
    description:
      "Live verification of /sitemap.xml and /robots.txt plus valid XML/robots generation.",
  },
};

export function SeoModule({ view }: { view: SeoSection }) {
  const me = useMe();
  const canManage = can(me.roles, "seo.manage");
  const canPublish = can(me.roles, "content.publish");
  const qc = useQueryClient();

  const fetchSeo = useServerFn(getSeoCentreFn);
  const crawlFn = useServerFn(runSeoCrawlFn);
  const issueFn = useServerFn(updateSeoIssueStatusFn);
  const saveCmsFn = useServerFn(saveCmsDocumentFn);
  const fetchAiFn = useServerFn(getAiWorkspaceFn);
  const genAiFn = useServerFn(generateAiReportFn);

  const seoQuery = useQuery({
    queryKey: ["seo-centre"],
    queryFn: () => fetchSeo(),
  });

  const aiQuery = useQuery({
    queryKey: ["ai-workspace"],
    enabled: view === "suggestions",
    queryFn: () => fetchAiFn(),
  });

  const [lastCrawlMeta, setLastCrawlMeta] = useState<{
    sitemapStatus: number;
    robotsStatus: number;
    brokenLinks: string[];
  } | null>(null);

  const crawlMutation = useMutation({
    mutationFn: () => crawlFn(),
    onSuccess: (res) => {
      setLastCrawlMeta({
        sitemapStatus: res.sitemapStatus,
        robotsStatus: res.robotsStatus,
        brokenLinks: res.brokenLinks,
      });
      toast.success(`Crawled ${res.audits.length} pages · ${res.issues.length} findings.`);
      void qc.invalidateQueries({ queryKey: ["seo-centre"] });
      void qc.invalidateQueries({ queryKey: ["executive-overview"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Live SEO crawl failed"),
  });

  const issueMutation = useMutation({
    mutationFn: (p: { id: string; status: "open" | "resolved" | "ignored" }) =>
      issueFn({ data: p }),
    onSuccess: () => {
      toast.success("Issue status updated.");
      void qc.invalidateQueries({ queryKey: ["seo-centre"] });
      void qc.invalidateQueries({ queryKey: ["executive-overview"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const audits = seoQuery.data?.audits ?? [];
  const issues = seoQuery.data?.issues ?? [];
  const cmsPages = seoQuery.data?.cmsPages ?? [];
  const openErrors = issues.filter((i) => i.status === "open" && i.severity === "error");
  const openWarnings = issues.filter((i) => i.status === "open" && i.severity === "warning");

  // Page / Social / Schema editor state
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const selectedDoc: CmsDocumentRecord | undefined = useMemo(
    () => cmsPages.find((d) => d.id === selectedDocId) ?? cmsPages[0],
    [cmsPages, selectedDocId],
  );
  const [seoForm, setSeoForm] = useState({
    seoTitle: "",
    metaDescription: "",
    canonicalUrl: "",
    robots: "index, follow",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    jsonLd: "",
  });

  useEffect(() => {
    if (selectedDoc) {
      setSeoForm({
        seoTitle: selectedDoc.seo.seoTitle ?? "",
        metaDescription: selectedDoc.seo.metaDescription ?? "",
        canonicalUrl: selectedDoc.seo.canonicalUrl ?? "",
        robots: selectedDoc.seo.robots ?? "index, follow",
        ogTitle: selectedDoc.seo.ogTitle ?? "",
        ogDescription: selectedDoc.seo.ogDescription ?? "",
        ogImage: selectedDoc.seo.ogImage ?? "",
        jsonLd: selectedDoc.seo.jsonLd ?? "",
      });
    }
  }, [selectedDoc]);

  const saveSeoMutation = useMutation({
    mutationFn: async (status: "draft" | "published") => {
      if (!selectedDoc) throw new Error("Select a page first");
      const res = await saveCmsFn({
        data: {
          id: selectedDoc.id,
          doc_type: selectedDoc.doc_type,
          slug: selectedDoc.slug,
          title: selectedDoc.title,
          summary: selectedDoc.summary,
          category: selectedDoc.category,
          status: canPublish ? status : "draft",
          payload: selectedDoc.payload,
          seo: seoForm,
          change_summary: "Updated SEO / Schema metadata from SEO Centre",
        },
      });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: (res) => {
      toast.success(
        res.document.status === "published" ? "SEO metadata published." : "SEO saved as draft.",
      );
      void qc.invalidateQueries({ queryKey: ["seo-centre"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save SEO fields"),
  });

  const genSeoAiMutation = useMutation({
    mutationFn: () => genAiFn({ data: { reportType: "seo" } }),
    onSuccess: () => {
      toast.success("Generated AI SEO recommendations brief.");
      void qc.invalidateQueries({ queryKey: ["ai-workspace"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to generate suggestions"),
  });

  const [issueStatusTab, setIssueStatusTab] = useState<"open" | "resolved" | "ignored">("open");
  const visibleIssues = issues.filter((i) => i.status === issueStatusTab);

  // Duplicate title detection from crawled audits
  const duplicateTitles = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of audits) {
      if (!a.title) continue;
      map.set(a.title, [...(map.get(a.title) ?? []), a.page_path]);
    }
    return [...map.entries()].filter(([, paths]) => paths.length > 1);
  }, [audits]);

  const hdr = HEADERS[view];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="SEO Centre"
        title={hdr.title}
        description={hdr.description}
        actions={
          <Button onClick={() => crawlMutation.mutate()} disabled={crawlMutation.isPending}>
            <RefreshCw className={crawlMutation.isPending ? "animate-spin" : undefined} />
            {crawlMutation.isPending ? "Crawling live website…" : "Run live site crawl"}
          </Button>
        }
      />

      {/* Shared Live Crawl Status Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel>
          <p className="text-xs text-muted-foreground">Pages Crawled</p>
          <p className="mt-1 font-display text-3xl text-primary">{audits.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {audits[0]?.checked_at
              ? `Last scan ${fmtRelative(audits[0].checked_at)}`
              : "Never scanned"}
          </p>
        </Panel>
        <Panel>
          <p className="text-xs text-muted-foreground">Open Errors</p>
          <p className="mt-1 font-display text-3xl text-destructive">{openErrors.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Critical index / title / sitemap items
          </p>
        </Panel>
        <Panel>
          <p className="text-xs text-muted-foreground">Open Warnings</p>
          <p className="mt-1 font-display text-3xl text-warning">{openWarnings.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">OG tags, canonicals, schema, GA4</p>
        </Panel>
        <Panel>
          <p className="text-xs text-muted-foreground">Duplicate Titles</p>
          <p className="mt-1 font-display text-3xl text-primary">{duplicateTitles.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {duplicateTitles[0]
              ? `“${duplicateTitles[0][0]}” on ${duplicateTitles[0][1].length} pages`
              : "No duplicates detected"}
          </p>
        </Panel>
      </div>

      {view === "overview" && (
        <Panel
          title="Live Website Crawl Results"
          description="Fetched directly from https://ryzite-website.thulirkalcom.workers.dev/"
        >
          {audits.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title="No live crawl stored yet"
              description="Click “Run live site crawl” above to inspect every core page on the production Worker."
            >
              <Button onClick={() => crawlMutation.mutate()} disabled={crawlMutation.isPending}>
                Run live site crawl
              </Button>
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Page</th>
                    <th className="py-2 pr-3">HTTP</th>
                    <th className="py-2 pr-3">Title</th>
                    <th className="py-2 pr-3">Canonical</th>
                    <th className="py-2 pr-3">H1</th>
                    <th className="py-2 pr-3">Schema</th>
                    <th className="py-2">GA4</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {audits.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2.5 pr-3 font-medium">{a.page_path}</td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={a.status_code === 200 ? "success" : "danger"}>
                          {a.status_code}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 max-w-[240px] truncate" title={a.title}>
                        {a.title || "Missing"}
                      </td>
                      <td className="py-2.5 pr-3">
                        {a.canonical_url ? (
                          <CheckCircle2 className="size-4 text-success" />
                        ) : (
                          <AlertTriangle className="size-4 text-warning" />
                        )}
                      </td>
                      <td className="py-2.5 pr-3">{a.h1_count}</td>
                      <td className="py-2.5 pr-3">
                        {a.has_json_ld ? a.json_ld_types.join(", ") || "Valid" : "None"}
                      </td>
                      <td className="py-2.5">{a.has_ga4_tag ? a.ga4_measurement_id : "Missing"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {(view === "pages" || view === "social" || view === "technical") && (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <Panel title="Managed Pages & Items" bodyClassName="p-0">
            <ul className="divide-y max-h-[600px] overflow-y-auto">
              {cmsPages.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedDocId(d.id)}
                    className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left ${
                      selectedDoc?.id === d.id ? "bg-accent" : "hover:bg-secondary/50"
                    }`}
                  >
                    <span className="truncate text-sm font-semibold">{d.title}</span>
                    <span className="truncate text-xs text-muted-foreground">{d.slug}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="space-y-6">
            {view === "pages" && selectedDoc && (
              <Panel title={`Page SEO: ${selectedDoc.title}`} description={selectedDoc.slug}>
                <div className="space-y-4">
                  <div className="rounded-xl border bg-white p-4 text-slate-900">
                    <p className="text-[0.6875rem] uppercase tracking-wider text-slate-500">
                      Google SERP Preview
                    </p>
                    <p className="mt-1 text-xs text-emerald-700">
                      {LIVE_SITE_URL.replace(/\/$/, "")}
                      {selectedDoc.slug}
                    </p>
                    <p className="text-lg font-medium text-blue-700">
                      {seoForm.seoTitle || selectedDoc.title}
                    </p>
                    <p className="text-sm text-slate-600">
                      {seoForm.metaDescription || selectedDoc.summary || "No meta description set."}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label>SEO Title ({seoForm.seoTitle.length}/60 recommended)</Label>
                    <Input
                      value={seoForm.seoTitle}
                      onChange={(e) => setSeoForm({ ...seoForm, seoTitle: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>
                      Meta Description ({seoForm.metaDescription.length}/160 recommended)
                    </Label>
                    <Textarea
                      rows={3}
                      value={seoForm.metaDescription}
                      onChange={(e) => setSeoForm({ ...seoForm, metaDescription: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Canonical URL</Label>
                      <Input
                        value={seoForm.canonicalUrl}
                        onChange={(e) => setSeoForm({ ...seoForm, canonicalUrl: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Robots Meta</Label>
                      <Input
                        value={seoForm.robots}
                        onChange={(e) => setSeoForm({ ...seoForm, robots: e.target.value })}
                      />
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={saveSeoMutation.isPending}
                        onClick={() => saveSeoMutation.mutate("draft")}
                      >
                        <Save className="size-4" /> Save draft
                      </Button>
                      {canPublish && (
                        <Button
                          disabled={saveSeoMutation.isPending}
                          onClick={() => saveSeoMutation.mutate("published")}
                        >
                          Publish SEO
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Panel>
            )}

            {view === "social" && selectedDoc && (
              <Panel title={`Open Graph Card: ${selectedDoc.title}`}>
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-xl border bg-secondary/30 max-w-md">
                    {seoForm.ogImage && (
                      <img
                        src={seoForm.ogImage}
                        alt="Open Graph preview"
                        className="h-44 w-full object-cover bg-white"
                      />
                    )}
                    <div className="p-3">
                      <p className="text-xs uppercase text-muted-foreground">ryzite.lk</p>
                      <p className="font-semibold">
                        {seoForm.ogTitle || seoForm.seoTitle || selectedDoc.title}
                      </p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {seoForm.ogDescription || seoForm.metaDescription}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>OG Title</Label>
                    <Input
                      value={seoForm.ogTitle}
                      onChange={(e) => setSeoForm({ ...seoForm, ogTitle: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>OG Description</Label>
                    <Textarea
                      rows={2}
                      value={seoForm.ogDescription}
                      onChange={(e) => setSeoForm({ ...seoForm, ogDescription: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>OG Image URL</Label>
                    <Input
                      value={seoForm.ogImage}
                      onChange={(e) => setSeoForm({ ...seoForm, ogImage: e.target.value })}
                    />
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={saveSeoMutation.isPending}
                        onClick={() => saveSeoMutation.mutate("draft")}
                      >
                        Save draft
                      </Button>
                      {canPublish && (
                        <Button
                          disabled={saveSeoMutation.isPending}
                          onClick={() => saveSeoMutation.mutate("published")}
                        >
                          Publish Open Graph
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Panel>
            )}

            {view === "technical" && (
              <>
                <Panel title="Technical Diagnostics (From Live Crawl)">
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-semibold">
                        Duplicate Titles Detected ({duplicateTitles.length})
                      </p>
                      {duplicateTitles.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Run a live crawl or verify all pages use unique &lt;title&gt; values.
                        </p>
                      ) : (
                        <ul className="mt-1 space-y-1 text-xs">
                          {duplicateTitles.map(([t, paths]) => (
                            <li key={t}>
                              <Badge variant="danger">{paths.length} pages</Badge> “{t}” →{" "}
                              {paths.join(", ")}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">Broken Internal Links Checked</p>
                      <p className="text-xs text-muted-foreground">
                        {lastCrawlMeta
                          ? lastCrawlMeta.brokenLinks.length === 0
                            ? "No broken sampled internal links found."
                            : lastCrawlMeta.brokenLinks.join(", ")
                          : "Run a live crawl above to check sampled internal links."}
                      </p>
                    </div>
                  </div>
                </Panel>

                {selectedDoc && (
                  <Panel title={`JSON-LD Structured Data: ${selectedDoc.title}`}>
                    <div className="space-y-3">
                      <Textarea
                        rows={8}
                        className="font-mono text-xs"
                        value={seoForm.jsonLd}
                        onChange={(e) => setSeoForm({ ...seoForm, jsonLd: e.target.value })}
                        placeholder='{"@context":"https://schema.org","@type":"Organization","name":"RYZITE"}'
                      />
                      {canManage && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            disabled={saveSeoMutation.isPending}
                            onClick={() => saveSeoMutation.mutate("draft")}
                          >
                            <Code2 className="size-4" /> Validate & Save Draft
                          </Button>
                        </div>
                      )}
                    </div>
                  </Panel>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {view === "suggestions" && (
        <Panel
          title="AI SEO Recommendations (Human Approval Required)"
          description="Control Centre never publishes SEO edits automatically. Review suggestions below and apply to draft if desired."
          actions={
            <Button
              variant="subtle"
              disabled={genSeoAiMutation.isPending}
              onClick={() => genSeoAiMutation.mutate()}
            >
              <Sparkles className="size-4" />
              {genSeoAiMutation.isPending ? "Generating…" : "Generate SEO brief"}
            </Button>
          }
        >
          {aiQuery.data?.reports.filter((r) => r.report_type === "seo").length ? (
            <div className="space-y-4">
              {aiQuery.data.reports
                .filter((r) => r.report_type === "seo")
                .slice(0, 3)
                .map((rep) => (
                  <div key={rep.id} className="rounded-xl border p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{rep.title}</span>
                      <Badge variant="muted">{rep.provider}</Badge>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-line">{rep.summary}</p>
                    {rep.recommendations.length > 0 && (
                      <ul className="space-y-2 pt-2">
                        {rep.recommendations.map((rec, i) => (
                          <li key={i} className="rounded-lg bg-secondary/50 p-3 text-xs">
                            <span className="font-semibold">{rec.title}</span>
                            {rec.targetUrl && (
                              <span className="text-muted-foreground"> ({rec.targetUrl})</span>
                            )}
                            <p className="mt-1 text-muted-foreground">{rec.detail}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <EmptyState
              icon={<Lightbulb />}
              title="No SEO recommendation briefs generated yet"
              description="Run a live SEO crawl first, then generate an approval-gated SEO brief."
            />
          )}
        </Panel>
      )}

      {view === "issues" && (
        <Panel
          title="SEO Issues & Corrections"
          actions={
            <Tabs
              value={issueStatusTab}
              onValueChange={(v) => setIssueStatusTab(v as typeof issueStatusTab)}
            >
              <TabsList>
                <TabsTrigger value="open">
                  Open ({openErrors.length + openWarnings.length})
                </TabsTrigger>
                <TabsTrigger value="resolved">
                  Resolved ({issues.filter((i) => i.status === "resolved").length})
                </TabsTrigger>
                <TabsTrigger value="ignored">
                  Ignored ({issues.filter((i) => i.status === "ignored").length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          }
        >
          {visibleIssues.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 />}
              title={`No ${issueStatusTab} SEO issues`}
              description="Run a live website crawl to verify current production metadata."
            />
          ) : (
            <ul className="divide-y">
              {visibleIssues.map((issue) => (
                <li key={issue.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={issue.severity === "error" ? "danger" : "warning"}>
                        {issue.severity}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground">
                        {issue.page_path}
                      </span>
                      <span className="font-semibold text-sm">{issue.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{issue.explanation}</p>
                    <p className="text-xs text-electric">Fix: {issue.suggested_fix}</p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1.5">
                      {issue.status !== "resolved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => issueMutation.mutate({ id: issue.id, status: "resolved" })}
                        >
                          Resolve
                        </Button>
                      )}
                      {issue.status !== "ignored" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => issueMutation.mutate({ id: issue.id, status: "ignored" })}
                        >
                          Ignore
                        </Button>
                      )}
                      {issue.status !== "open" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => issueMutation.mutate({ id: issue.id, status: "open" })}
                        >
                          Reopen
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {view === "sitemap" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title="Generated XML Sitemap"
            description="Built from published Control Centre documents — also exposed live at /api/public/sitemap.xml"
            actions={
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(seoQuery.data?.generatedSitemapXml ?? "");
                    toast.success("Copied sitemap XML");
                  }}
                >
                  <Copy className="size-3.5" /> Copy
                </Button>
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={() => {
                    const blob = new Blob([seoQuery.data?.generatedSitemapXml ?? ""], {
                      type: "application/xml",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "sitemap.xml";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="size-3.5" /> Download
                </Button>
              </div>
            }
          >
            <pre className="max-h-96 overflow-auto rounded-xl border bg-secondary/40 p-3 text-xs">
              {seoQuery.data?.generatedSitemapXml ?? "Loading…"}
            </pre>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <a
                className="inline-flex items-center gap-1 text-electric hover:underline"
                href="/api/public/sitemap.xml"
                target="_blank"
                rel="noreferrer"
              >
                Open Control Centre /api/public/sitemap.xml <ExternalLink className="size-3" />
              </a>
              <a
                className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
                href={`${LIVE_SITE_URL}sitemap.xml`}
                target="_blank"
                rel="noreferrer"
              >
                Check live Worker /sitemap.xml <ExternalLink className="size-3" />
              </a>
            </div>
          </Panel>

          <Panel
            title="Robots.txt Directives"
            description="Also served at /api/public/robots.txt"
            actions={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(seoQuery.data?.generatedRobotsTxt ?? "");
                  toast.success("Copied robots.txt");
                }}
              >
                <Copy className="size-3.5" /> Copy
              </Button>
            }
          >
            <pre className="rounded-xl border bg-secondary/40 p-3 text-xs">
              {seoQuery.data?.generatedRobotsTxt ?? "Loading…"}
            </pre>
            <div className="mt-4 rounded-xl border bg-secondary/30 p-3 text-xs text-muted-foreground">
              {lastCrawlMeta ? (
                <p>
                  Last live probe: <code>/sitemap.xml</code> HTTP {lastCrawlMeta.sitemapStatus},
                  <code> /robots.txt</code> HTTP {lastCrawlMeta.robotsStatus}.
                </p>
              ) : (
                <p>
                  Run a live site crawl to inspect current HTTP status codes for{" "}
                  <code>/sitemap.xml</code> and <code>/robots.txt</code> on the Astro Worker.
                </p>
              )}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
