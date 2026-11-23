import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BriefcaseBusiness,
  Check,
  FileText,
  History,
  Layers,
  Menu,
  MessageSquareQuote,
  Newspaper,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/hooks/use-me";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { can } from "@/lib/permissions";
import {
  deleteCmsDocumentFn,
  getCmsCollection,
  getVersionHistoryFn,
  restoreCmsRevisionFn,
  saveCmsDocumentFn,
} from "@/lib/platform.functions";
import type {
  CmsDocType,
  CmsDocumentRecord,
  CmsRevisionRecord,
  CmsStatus,
} from "@/lib/platform-db.server";
import type { JsonValue } from "@/lib/session";

export type WebsiteCmsSection =
  "pages" | "portfolio" | "services" | "team" | "articles" | "testimonials";

const SECTION_CONFIG: Record<
  WebsiteCmsSection,
  {
    title: string;
    description: string;
    docTypes: CmsDocType[];
    defaultType: CmsDocType;
    emptyTitle: string;
    emptyDescription: string;
    icon: typeof FileText;
  }
> = {
  pages: {
    title: "Pages & Content",
    description:
      "Manage core website pages, multilingual copy (EN / TA / SI), calls to action, and page-level SEO metadata.",
    docTypes: ["page"],
    defaultType: "page",
    emptyTitle: "No pages found",
    emptyDescription: "Create a website page entry to manage its sections and SEO.",
    icon: FileText,
  },
  portfolio: {
    title: "Portfolio / Projects",
    description:
      "Approved client case studies with deliverables, technology stack, project links, and galleries.",
    docTypes: ["portfolio"],
    defaultType: "portfolio",
    emptyTitle: "No published case studies yet",
    emptyDescription:
      "The website shows only approved work. Add a verified client case study when ready for review.",
    icon: BriefcaseBusiness,
  },
  services: {
    title: "Services & Solutions",
    description:
      "Marketing Services (11) and Technology Solutions (9) imported from the live RYZITE codebase.",
    docTypes: ["service", "solution"],
    defaultType: "service",
    emptyTitle: "No services or solutions match",
    emptyDescription: "Add a marketing service or technology solution.",
    icon: Layers,
  },
  team: {
    title: "Team Members",
    description: "Leadership and specialist profiles, roles, biographies, and social links.",
    docTypes: ["team"],
    defaultType: "team",
    emptyTitle: "No team profiles added yet",
    emptyDescription: "Add genuine RYZITE team members when ready to feature them on the website.",
    icon: Users,
  },
  articles: {
    title: "Articles & Blog",
    description: "Long-form editorial articles, authors, categories, tags, and social share cards.",
    docTypes: ["article"],
    defaultType: "article",
    emptyTitle: "No articles yet",
    emptyDescription: "Create a draft article or convert an AI content brief into a draft.",
    icon: Newspaper,
  },
  testimonials: {
    title: "Testimonials",
    description: "Verified client quotes, company attribution, role, and display priority.",
    docTypes: ["testimonial"],
    defaultType: "testimonial",
    emptyTitle: "No client testimonials added yet",
    emptyDescription:
      "Never fabricate client quotes. Add verified client testimonials here once approved.",
    icon: MessageSquareQuote,
  },
};

const STATUS_BADGE: Record<CmsStatus, "success" | "warning" | "info" | "muted"> = {
  published: "success",
  draft: "warning",
  scheduled: "info",
  archived: "muted",
};

interface DraftState {
  id?: string | undefined;
  doc_type: CmsDocType;
  slug: string;
  title: string;
  summary: string;
  category: string;
  status: CmsStatus;
  sort_order: number;
  scheduled_at: string;
  payload: Record<string, JsonValue | undefined>;
  seo: {
    seoTitle: string;
    metaDescription: string;
    canonicalUrl: string;
    robots: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
  };
  change_summary: string;
}

function toDraftState(doc: CmsDocumentRecord): DraftState {
  return {
    id: doc.id,
    doc_type: doc.doc_type,
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    category: doc.category,
    status: doc.status,
    sort_order: doc.sort_order,
    scheduled_at: doc.scheduled_at ?? "",
    payload: { ...doc.payload },
    seo: {
      seoTitle: doc.seo.seoTitle ?? "",
      metaDescription: doc.seo.metaDescription ?? "",
      canonicalUrl: doc.seo.canonicalUrl ?? "",
      robots: doc.seo.robots ?? "index, follow",
      ogTitle: doc.seo.ogTitle ?? "",
      ogDescription: doc.seo.ogDescription ?? "",
      ogImage: doc.seo.ogImage ?? "",
    },
    change_summary: "",
  };
}

function emptyDraft(docType: CmsDocType): DraftState {
  return {
    doc_type: docType,
    slug: docType === "page" ? "/new-page" : `new-${docType}-${Date.now().toString().slice(-4)}`,
    title: "",
    summary: "",
    category:
      docType === "service"
        ? "Marketing Service"
        : docType === "solution"
          ? "Technology Solution"
          : "",
    status: "draft",
    sort_order: 100,
    scheduled_at: "",
    payload:
      docType === "page"
        ? {
            locales: {
              en: { heroTitle: "", heroSubtitle: "", ctaLabel: "", ctaHref: "/contact", body: "" },
              ta: { heroTitle: "", heroSubtitle: "", ctaLabel: "", ctaHref: "/contact", body: "" },
              si: { heroTitle: "", heroSubtitle: "", ctaLabel: "", ctaHref: "/contact", body: "" },
            },
          }
        : {},
    seo: {
      seoTitle: "",
      metaDescription: "",
      canonicalUrl: "",
      robots: "index, follow",
      ogTitle: "",
      ogDescription: "",
      ogImage: "",
    },
    change_summary: "Initial draft",
  };
}

export function CmsManagerModule({ section }: { section: WebsiteCmsSection }) {
  const me = useMe();
  const canPublish = can(me.roles, "content.publish");
  const cfg = SECTION_CONFIG[section];
  const qc = useQueryClient();

  const fetchCollection = useServerFn(getCmsCollection);
  const saveFn = useServerFn(saveCmsDocumentFn);
  const deleteFn = useServerFn(deleteCmsDocumentFn);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CmsStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | CmsDocType>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [langTab, setLangTab] = useState<"en" | "ta" | "si">("en");
  const [deleteTarget, setDeleteTarget] = useState<CmsDocumentRecord | null>(null);

  const query = useQuery({
    queryKey: ["cms-collection", section],
    queryFn: () => fetchCollection({ data: { docTypes: cfg.docTypes } }),
  });

  const filteredDocs = useMemo(() => {
    const docs = query.data?.documents ?? [];
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (typeFilter !== "all" && d.doc_type !== typeFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.slug.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
      );
    });
  }, [query.data, search, statusFilter, typeFilter]);

  useEffect(() => {
    if (!filteredDocs.length) return;
    if (!selectedId || !filteredDocs.some((d) => d.id === selectedId)) {
      const first = filteredDocs[0];
      if (first) {
        setSelectedId(first.id);
        setDraft(toDraftState(first));
      }
    }
  }, [filteredDocs, selectedId]);

  const saveMutation = useMutation({
    mutationFn: async (targetStatus: CmsStatus) => {
      if (!draft) throw new Error("Nothing to save");
      const status = canPublish ? targetStatus : "draft";
      const res = await saveFn({
        data: {
          ...(draft.id ? { id: draft.id } : {}),
          doc_type: draft.doc_type,
          slug: draft.slug,
          title: draft.title,
          summary: draft.summary,
          category: draft.category,
          status,
          sort_order: draft.sort_order,
          scheduled_at: draft.scheduled_at ? draft.scheduled_at : null,
          payload: draft.payload,
          seo: draft.seo,
          change_summary:
            draft.change_summary.trim() ||
            (status === "published" ? "Published update" : "Saved draft"),
        },
      });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: (res) => {
      toast.success(
        res.document.status === "published" ? "Saved and published." : "Saved as draft.",
      );
      if (res.sanity && !res.sanity.synced && res.sanity.reason) {
        toast.message(res.sanity.reason);
      }
      setSelectedId(res.document.id);
      setDraft(toDraftState(res.document));
      void qc.invalidateQueries({ queryKey: ["cms-collection", section] });
      void qc.invalidateQueries({ queryKey: ["cms-history"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Content item deleted.");
      setDeleteTarget(null);
      setSelectedId(null);
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ["cms-collection", section] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const locales = (draft?.payload["locales"] ?? {}) as Record<
    string,
    {
      heroTitle?: string;
      heroSubtitle?: string;
      ctaLabel?: string;
      ctaHref?: string;
      body?: string;
    }
  >;
  const activeLocale = locales[langTab] ?? {};

  function updateLocaleField(field: string, value: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      payload: {
        ...draft.payload,
        locales: {
          ...locales,
          [langTab]: { ...activeLocale, [field]: value },
        },
      },
    });
  }

  function updatePayloadField(field: string, value: JsonValue | undefined) {
    if (!draft) return;
    setDraft({
      ...draft,
      payload: { ...draft.payload, [field]: value },
    });
  }

  const EmptyIcon = cfg.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website Management"
        title={cfg.title}
        description={cfg.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/admin/$section/$page" params={{ section: "website", page: "history" }}>
                <History /> Version history
              </Link>
            </Button>
            <Button
              onClick={() => {
                setSelectedId(null);
                setDraft(emptyDraft(cfg.defaultType));
              }}
            >
              <Plus /> New {cfg.defaultType}
            </Button>
          </div>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search title, slug, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {section === "services" && (
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="service">Marketing Services</SelectItem>
                <SelectItem value="solution">Tech Solutions</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Badge variant={query.data?.sanity.hasWriteToken ? "success" : "muted"}>
            {query.data?.sanity.hasWriteToken
              ? "Sanity write sync active"
              : "D1 storage (Sanity write token optional)"}
          </Badge>
        </div>
      </Panel>

      {filteredDocs.length === 0 && !draft ? (
        <Panel>
          <EmptyState
            icon={<EmptyIcon />}
            title={cfg.emptyTitle}
            description={cfg.emptyDescription}
          >
            <Button
              onClick={() => {
                setSelectedId(null);
                setDraft(emptyDraft(cfg.defaultType));
              }}
            >
              <Plus /> Create {cfg.defaultType}
            </Button>
          </EmptyState>
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Panel title={`Items (${filteredDocs.length})`} bodyClassName="p-0">
            <ul className="divide-y max-h-[680px] overflow-y-auto">
              {filteredDocs.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(doc.id);
                      setDraft(toDraftState(doc));
                    }}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors ${
                      selectedId === doc.id ? "bg-accent" : "hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{doc.title}</span>
                      <Badge variant={STATUS_BADGE[doc.status]}>{doc.status}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {doc.slug} {doc.category ? `· ${doc.category}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          {draft && (
            <Panel
              title={draft.id ? `Editing: ${draft.title || "Untitled"}` : `New ${draft.doc_type}`}
              description={
                draft.id ? `Slug: ${draft.slug}` : "Save as draft first or publish if authorised."
              }
              actions={
                draft.id && canPublish ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      const doc = filteredDocs.find((d) => d.id === draft.id);
                      if (doc) setDeleteTarget(doc);
                    }}
                  >
                    <Trash2 className="size-4" /> Delete
                  </Button>
                ) : undefined
              }
            >
              <Tabs defaultValue="content" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="content">Content & Fields</TabsTrigger>
                  <TabsTrigger value="seo">SEO & Social</TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Title *</Label>
                      <Input
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Slug / Path *</Label>
                      <Input
                        value={draft.slug}
                        onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {section === "services" && (
                      <div className="space-y-1">
                        <Label>Type</Label>
                        <Select
                          value={draft.doc_type}
                          onValueChange={(v) => setDraft({ ...draft, doc_type: v as CmsDocType })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="service">Marketing Service</SelectItem>
                            <SelectItem value="solution">Technology Solution</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Input
                        value={draft.category}
                        onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Display Order</Label>
                      <Input
                        type="number"
                        value={draft.sort_order}
                        onChange={(e) =>
                          setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Summary</Label>
                    <Textarea
                      rows={2}
                      value={draft.summary}
                      onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                    />
                  </div>

                  {/* Page multilingual section editor */}
                  {draft.doc_type === "page" && (
                    <div className="rounded-xl border bg-secondary/20 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">Localized Page Copy</p>
                        <Tabs
                          value={langTab}
                          onValueChange={(v) => setLangTab(v as "en" | "ta" | "si")}
                        >
                          <TabsList>
                            <TabsTrigger value="en">English (EN)</TabsTrigger>
                            <TabsTrigger value="ta">Tamil (TA)</TabsTrigger>
                            <TabsTrigger value="si">Sinhala (SI)</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                      <div className="space-y-2">
                        <Label>Hero Headline ({langTab.toUpperCase()})</Label>
                        <Input
                          value={activeLocale.heroTitle ?? ""}
                          onChange={(e) => updateLocaleField("heroTitle", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Hero Subtitle ({langTab.toUpperCase()})</Label>
                        <Textarea
                          rows={2}
                          value={activeLocale.heroSubtitle ?? ""}
                          onChange={(e) => updateLocaleField("heroSubtitle", e.target.value)}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>CTA Label</Label>
                          <Input
                            value={activeLocale.ctaLabel ?? ""}
                            onChange={(e) => updateLocaleField("ctaLabel", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>CTA Link</Label>
                          <Input
                            value={activeLocale.ctaHref ?? ""}
                            onChange={(e) => updateLocaleField("ctaHref", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Page Sections / Body ({langTab.toUpperCase()})</Label>
                        <Textarea
                          rows={4}
                          value={activeLocale.body ?? ""}
                          onChange={(e) => updateLocaleField("body", e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Service / Solution features & benefits */}
                  {(draft.doc_type === "service" || draft.doc_type === "solution") && (
                    <div className="space-y-3 rounded-xl border bg-secondary/20 p-4">
                      <div className="space-y-1">
                        <Label>Key Features (one per line)</Label>
                        <Textarea
                          rows={4}
                          value={
                            Array.isArray(draft.payload["features"])
                              ? (draft.payload["features"] as string[]).join("\n")
                              : String(draft.payload["features"] ?? "")
                          }
                          onChange={(e) =>
                            updatePayloadField(
                              "features",
                              e.target.value
                                .split("\n")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Benefits / Value Proposition</Label>
                        <Textarea
                          rows={2}
                          value={String(draft.payload["benefits"] ?? "")}
                          onChange={(e) => updatePayloadField("benefits", e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Portfolio / Team / Article / Testimonial fields */}
                  {draft.doc_type === "article" && (
                    <div className="space-y-3 rounded-xl border bg-secondary/20 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Author</Label>
                          <Input
                            value={String(draft.payload["author"] ?? "")}
                            onChange={(e) => updatePayloadField("author", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Tags (comma separated)</Label>
                          <Input
                            value={String(draft.payload["tags"] ?? "")}
                            onChange={(e) => updatePayloadField("tags", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Article Body (Markdown / HTML)</Label>
                        <Textarea
                          rows={7}
                          value={String(draft.payload["body"] ?? "")}
                          onChange={(e) => updatePayloadField("body", e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {draft.doc_type === "portfolio" && (
                    <div className="grid gap-3 rounded-xl border bg-secondary/20 p-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Client Name</Label>
                        <Input
                          value={String(draft.payload["client"] ?? "")}
                          onChange={(e) => updatePayloadField("client", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Project URL</Label>
                        <Input
                          value={String(draft.payload["projectUrl"] ?? "")}
                          onChange={(e) => updatePayloadField("projectUrl", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label>Technologies Used</Label>
                        <Input
                          value={String(draft.payload["technologies"] ?? "")}
                          onChange={(e) => updatePayloadField("technologies", e.target.value)}
                          placeholder="Astro, Cloudflare Workers, Sanity, Tailwind CSS"
                        />
                      </div>
                    </div>
                  )}

                  {draft.doc_type === "team" && (
                    <div className="grid gap-3 rounded-xl border bg-secondary/20 p-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Role / Position</Label>
                        <Input
                          value={String(draft.payload["role"] ?? "")}
                          onChange={(e) => updatePayloadField("role", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Photo URL</Label>
                        <Input
                          value={String(draft.payload["photoUrl"] ?? "")}
                          onChange={(e) => updatePayloadField("photoUrl", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label>Biography</Label>
                        <Textarea
                          rows={3}
                          value={String(draft.payload["bio"] ?? "")}
                          onChange={(e) => updatePayloadField("bio", e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {draft.doc_type === "testimonial" && (
                    <div className="grid gap-3 rounded-xl border bg-secondary/20 p-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Company</Label>
                        <Input
                          value={String(draft.payload["company"] ?? "")}
                          onChange={(e) => updatePayloadField("company", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Client Role</Label>
                        <Input
                          value={String(draft.payload["role"] ?? "")}
                          onChange={(e) => updatePayloadField("role", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label>Verified Quote</Label>
                        <Textarea
                          rows={3}
                          value={String(draft.payload["quote"] ?? "")}
                          onChange={(e) => updatePayloadField("quote", e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="seo" className="space-y-3">
                  <div className="space-y-1">
                    <Label>SEO Meta Title ({draft.seo.seoTitle.length} chars)</Label>
                    <Input
                      value={draft.seo.seoTitle}
                      onChange={(e) =>
                        setDraft({ ...draft, seo: { ...draft.seo, seoTitle: e.target.value } })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Meta Description ({draft.seo.metaDescription.length} chars)</Label>
                    <Textarea
                      rows={3}
                      value={draft.seo.metaDescription}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          seo: { ...draft.seo, metaDescription: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Canonical URL</Label>
                      <Input
                        value={draft.seo.canonicalUrl}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            seo: { ...draft.seo, canonicalUrl: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Robots Directive</Label>
                      <Input
                        value={draft.seo.robots}
                        onChange={(e) =>
                          setDraft({ ...draft, seo: { ...draft.seo, robots: e.target.value } })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>OG Title</Label>
                      <Input
                        value={draft.seo.ogTitle}
                        onChange={(e) =>
                          setDraft({ ...draft, seo: { ...draft.seo, ogTitle: e.target.value } })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>OG Image URL</Label>
                      <Input
                        value={draft.seo.ogImage}
                        onChange={(e) =>
                          setDraft({ ...draft, seo: { ...draft.seo, ogImage: e.target.value } })
                        }
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="cms-change-summary">Revision note</Label>
                  <Input
                    id="cms-change-summary"
                    placeholder="Briefly describe what changed…"
                    value={draft.change_summary}
                    onChange={(e) => setDraft({ ...draft, change_summary: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={saveMutation.isPending || !draft.title || !draft.slug}
                    onClick={() => saveMutation.mutate("draft")}
                  >
                    <Save className="size-4" /> Save draft
                  </Button>
                  {canPublish && (
                    <Button
                      disabled={saveMutation.isPending || !draft.title || !draft.slug}
                      onClick={() => saveMutation.mutate("published")}
                    >
                      <Send className="size-4" /> Publish
                    </Button>
                  )}
                </div>
              </div>
            </Panel>
          )}
        </div>
      )}

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.title}?</DialogTitle>
            <DialogDescription>
              This permanently removes the document and its revision snapshots from D1.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function NavigationFooterModule() {
  const me = useMe();
  const canPublish = can(me.roles, "content.publish");
  const fetchCollection = useServerFn(getCmsCollection);
  const saveFn = useServerFn(saveCmsDocumentFn);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["cms-collection", "navigation"],
    queryFn: () => fetchCollection({ data: { docTypes: ["navigation"] } }),
  });

  const navDoc = query.data?.documents[0];
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [email, setEmail] = useState("info@ryzite.lk");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);

  useEffect(() => {
    if (navDoc && navDoc.id !== loadedId) {
      setLoadedId(navDoc.id);
      const p = navDoc.payload as {
        headerLinks?: Array<{ label: string; href: string }>;
        footerLinks?: Array<{ label: string; href: string }>;
        contact?: { email?: string; phone?: string; address?: string };
      };
      setHeaderText((p.headerLinks ?? []).map((l) => `${l.label} | ${l.href}`).join("\n"));
      setFooterText((p.footerLinks ?? []).map((l) => `${l.label} | ${l.href}`).join("\n"));
      setEmail(p.contact?.email ?? "info@ryzite.lk");
      setPhone(p.contact?.phone ?? "");
      setAddress(p.contact?.address ?? "");
    }
  }, [navDoc, loadedId]);

  const parseLinks = (raw: string) =>
    raw
      .split("\n")
      .map((line) => line.split("|").map((x) => x.trim()))
      .filter(([label, href]) => Boolean(label && href))
      .map(([label, href]) => ({ label, href }));

  const saveMutation = useMutation({
    mutationFn: (status: "draft" | "published") =>
      saveFn({
        data: {
          id: navDoc?.id ?? "nav-global",
          doc_type: "navigation",
          slug: "global-navigation",
          title: navDoc?.title ?? "Global Navigation, Footer & Contact Channels",
          summary: "Header links, footer links, and contact info",
          category: "Navigation",
          status: canPublish ? status : "draft",
          payload: {
            ...(navDoc?.payload ?? {}),
            headerLinks: parseLinks(headerText),
            footerLinks: parseLinks(footerText),
            contact: { email, phone, address },
          },
          seo: {},
          change_summary: "Updated navigation & footer config",
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.document.status === "published" ? "Navigation & footer published." : "Saved as draft.",
      );
      void qc.invalidateQueries({ queryKey: ["cms-collection", "navigation"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website Management"
        title="Navigation & Footer"
        description="Configure global header links, footer menu links, and official contact channels (format: Label | /path)."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate("draft")}
            >
              <Save className="size-4" /> Save draft
            </Button>
            {canPublish && (
              <Button
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate("published")}
              >
                <Check className="size-4" /> Publish
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Header Menu Links" description="One link per line: Label | /path">
          <Textarea
            rows={8}
            value={headerText}
            onChange={(e) => setHeaderText(e.target.value)}
            placeholder="Services | /services/"
          />
        </Panel>
        <Panel title="Footer Links" description="One link per line: Label | /path">
          <Textarea
            rows={8}
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder="Privacy Policy | /privacy/"
          />
        </Panel>
      </div>

      <Panel title="Company Contact Information" description="Exposed via /api/public/content">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Primary Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Phone / WhatsApp</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Location / Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
      </Panel>
    </div>
  );
}

export function HistoryModule() {
  const qc = useQueryClient();
  const fetchHistory = useServerFn(getVersionHistoryFn);
  const restoreFn = useServerFn(restoreCmsRevisionFn);

  const [docFilter, setDocFilter] = useState("all");
  const [selectedRev, setSelectedRev] = useState<CmsRevisionRecord | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<CmsRevisionRecord | null>(null);

  const query = useQuery({
    queryKey: ["cms-history", docFilter],
    queryFn: () =>
      fetchHistory({
        data: docFilter === "all" ? {} : { documentId: docFilter },
      }),
  });

  const restoreMutation = useMutation({
    mutationFn: (revisionId: string) => restoreFn({ data: { revisionId } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Restored version as a draft for review.");
      setConfirmRestore(null);
      void qc.invalidateQueries({ queryKey: ["cms-history"] });
      void qc.invalidateQueries({ queryKey: ["cms-collection"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Restore failed"),
  });

  const revisions = query.data?.revisions ?? [];
  const documents = query.data?.documents ?? [];
  const active = selectedRev ?? revisions[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website Management"
        title="Content Version History"
        description="Immutable revision log across all pages, services, articles, and SEO overrides. Restore any prior version as a draft."
      />

      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <Label>Filter by document:</Label>
          <Select value={docFilter} onValueChange={setDocFilter}>
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All documents ({documents.length})</SelectItem>
              {documents.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.title} ({d.doc_type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Panel>

      {revisions.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Menu />}
            title="No revisions recorded"
            description="Saving or publishing any CMS document creates a version snapshot here."
          />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <Panel title={`Revisions (${revisions.length})`} bodyClassName="p-0">
            <ul className="divide-y max-h-[600px] overflow-y-auto">
              {revisions.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRev(r)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors ${
                      active?.id === r.id ? "bg-accent" : "hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        v{r.version} · {r.title}
                      </span>
                      <Badge variant="muted">{r.action}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{r.change_summary}</p>
                    <p className="text-[0.6875rem] text-muted-foreground">
                      {r.editor_label || "System"} · {fmtRelative(r.created_at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          {active && (
            <Panel
              title={`Version v${active.version} — ${active.title}`}
              description={`Captured ${fmtDateTime(active.created_at)} by ${active.editor_label || "System"}`}
              actions={
                <Button size="sm" variant="subtle" onClick={() => setConfirmRestore(active)}>
                  <RotateCcw className="size-3.5" /> Restore as draft
                </Button>
              }
            >
              <p className="mb-3 text-sm text-muted-foreground">{active.change_summary}</p>
              <pre className="max-h-[480px] overflow-auto rounded-xl border bg-secondary/40 p-4 text-xs">
                {JSON.stringify(active.snapshot, null, 2)}
              </pre>
            </Panel>
          )}
        </div>
      )}

      <Dialog open={Boolean(confirmRestore)} onOpenChange={(o) => !o && setConfirmRestore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore version v{confirmRestore?.version}?</DialogTitle>
            <DialogDescription>
              Restoring loads this snapshot into a new draft revision for human review without
              auto-publishing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestore(null)}>
              Cancel
            </Button>
            <Button
              disabled={restoreMutation.isPending}
              onClick={() => confirmRestore && restoreMutation.mutate(confirmRestore.id)}
            >
              {restoreMutation.isPending ? "Restoring…" : "Restore as draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
