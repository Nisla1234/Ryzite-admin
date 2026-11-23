import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { SEED_CMS_DOCUMENTS } from "./platform-seed.server";
import { getD1Database } from "./runtime-env.server";
import type { JsonValue } from "./session";

export type CmsDocType =
  | "page"
  | "portfolio"
  | "service"
  | "solution"
  | "team"
  | "article"
  | "testimonial"
  | "navigation"
  | "seo_override";

export type CmsStatus = "draft" | "scheduled" | "published" | "archived";

export interface CmsSeoFields {
  seoTitle?: string | undefined;
  metaDescription?: string | undefined;
  canonicalUrl?: string | undefined;
  robots?: string | undefined;
  ogTitle?: string | undefined;
  ogDescription?: string | undefined;
  ogImage?: string | undefined;
  jsonLd?: string | undefined;
}

export interface CmsDocumentRecord {
  id: string;
  sanity_id: string | null;
  doc_type: CmsDocType;
  slug: string;
  title: string;
  summary: string;
  category: string;
  status: CmsStatus;
  sort_order: number;
  payload: Record<string, JsonValue | undefined>;
  seo: CmsSeoFields;
  scheduled_at: string | null;
  published_at: string | null;
  sanity_synced_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CmsRevisionRecord {
  id: string;
  document_id: string;
  version: number;
  title: string;
  status: string;
  snapshot: Record<string, JsonValue | undefined>;
  change_summary: string;
  action: "draft_saved" | "published" | "unpublished" | "archived" | "restored" | "imported";
  editor_id: string | null;
  editor_label: string | null;
  created_at: string;
}

export interface MediaAssetRecord {
  id: string;
  source: "sanity" | "github" | "d1";
  asset_key: string;
  url: string;
  filename: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  alt_text: string;
  caption: string;
  folder: string;
  data_url: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnquiryRecord {
  id: string;
  name: string;
  business: string;
  email: string;
  phone: string;
  service: string;
  subject: string;
  message: string;
  source_page: string;
  status: "new" | "in_review" | "replied" | "archived";
  is_read: boolean;
  assigned_to: string | null;
  category: string;
  internal_notes: string;
  requester_ip: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeoAuditRecord {
  id: string;
  url: string;
  page_path: string;
  status_code: number;
  title: string;
  meta_description: string;
  canonical_url: string;
  robots_meta: string;
  og_title: string;
  og_description: string;
  og_image: string;
  h1_count: number;
  h1_text: string;
  has_json_ld: boolean;
  json_ld_types: string[];
  has_ga4_tag: boolean;
  ga4_measurement_id: string | null;
  broken_links: string[];
  issues: Array<Record<string, JsonValue | undefined>>;
  response_ms: number;
  checked_at: string;
}

export interface SeoIssueRecord {
  id: string;
  page_path: string;
  url: string;
  severity: "error" | "warning" | "info";
  code: string;
  title: string;
  explanation: string;
  suggested_fix: string;
  status: "open" | "resolved" | "ignored";
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageSpeedReportRecord {
  id: string;
  url: string;
  strategy: "mobile" | "desktop";
  performance_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  seo_score: number | null;
  lcp_ms: number | null;
  inp_ms: number | null;
  cls_score: number | null;
  fcp_ms: number | null;
  ttfb_ms: number | null;
  field_lcp_ms: number | null;
  field_inp_ms: number | null;
  field_cls: number | null;
  opportunities: Array<{
    id: string;
    title: string;
    description: string;
    savingsMs?: number;
    savingsBytes?: number;
  }>;
  audits: Array<{
    id: string;
    title: string;
    score: number | null;
    category: string;
    displayValue?: string;
  }>;
  error: string | null;
  created_at: string;
}

export interface AiReportRecord {
  id: string;
  report_type: "daily" | "health" | "seo" | "content";
  title: string;
  summary: string;
  provider: string;
  grounded_signals: Record<string, JsonValue | undefined>;
  recommendations: Array<{
    title: string;
    detail: string;
    priority: "high" | "medium" | "low";
    targetUrl?: string | undefined;
    category?: string | undefined;
  }>;
  created_by: string | null;
  created_at: string;
}

export interface AiTaskRecord {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  source: "seo" | "performance" | "ai" | "system";
  related_url: string;
  status: "open" | "in_progress" | "done" | "dismissed";
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformSettings {
  liveSiteUrl: string;
  sanityProjectId: string;
  sanityDataset: string;
  defaultSeoTitleSuffix: string;
  defaultOgImage: string;
  defaultRobotsDirective: string;
  ga4MeasurementTagExpected: string;
  preferredAiProvider: "auto" | "gemini" | "openai";
  pagespeedStrategyDefault: "mobile" | "desktop";
  sessionMaxAgeHours: number;
  enquiryNotificationEmail: string;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  liveSiteUrl: "https://ryzite-website.thulirkalcom.workers.dev",
  sanityProjectId: "hnm8jy5w",
  sanityDataset: "production",
  defaultSeoTitleSuffix: " | RYZITE",
  defaultOgImage: "https://ryzite-website.thulirkalcom.workers.dev/images/ryzite-logo.webp",
  defaultRobotsDirective: "index, follow",
  ga4MeasurementTagExpected: "",
  preferredAiProvider: "auto",
  pagespeedStrategyDefault: "mobile",
  sessionMaxAgeHours: 24,
  enquiryNotificationEmail: "info@ryzite.lk",
};

interface PlatformLocalStore {
  seeded: boolean;
  cms_documents: CmsDocumentRecord[];
  cms_revisions: CmsRevisionRecord[];
  media_assets: MediaAssetRecord[];
  website_enquiries: EnquiryRecord[];
  seo_audits: SeoAuditRecord[];
  seo_issues: SeoIssueRecord[];
  pagespeed_reports: PageSpeedReportRecord[];
  ai_reports: AiReportRecord[];
  ai_tasks: AiTaskRecord[];
  system_settings: Record<
    string,
    { value: unknown; updated_by: string | null; updated_at: string }
  >;
}

const PLATFORM_LOCAL_KEY = "__RYZITE_PLATFORM_LOCAL_STORE__";

function buildInitialDocuments(): { docs: CmsDocumentRecord[]; revs: CmsRevisionRecord[] } {
  const now = new Date().toISOString();
  const docs: CmsDocumentRecord[] = [];
  const revs: CmsRevisionRecord[] = [];
  for (const s of SEED_CMS_DOCUMENTS) {
    docs.push({
      id: s.id,
      sanity_id: null,
      doc_type: s.docType,
      slug: s.slug,
      title: s.title,
      summary: s.summary,
      category: s.category,
      status: s.status,
      sort_order: s.sortOrder,
      payload: s.payload,
      seo: s.seo,
      scheduled_at: null,
      published_at: s.status === "published" ? now : null,
      sanity_synced_at: null,
      updated_by: "system-seed",
      created_at: now,
      updated_at: now,
    });
    revs.push({
      id: `rev-${s.id}-1`,
      document_id: s.id,
      version: 1,
      title: s.title,
      status: s.status,
      snapshot: {
        title: s.title,
        summary: s.summary,
        category: s.category,
        slug: s.slug,
        payload: s.payload,
        seo: { ...s.seo },
      },
      change_summary: "Imported from main website repository (Nisla1234/ryzite-unified-platform)",
      action: "imported",
      editor_id: null,
      editor_label: "Website repository import",
      created_at: now,
    });
  }
  return { docs, revs };
}

function getPlatformStore(): PlatformLocalStore {
  const g = globalThis as Record<string, unknown>;
  if (!g[PLATFORM_LOCAL_KEY]) {
    const { docs, revs } = buildInitialDocuments();
    g[PLATFORM_LOCAL_KEY] = {
      seeded: true,
      cms_documents: docs,
      cms_revisions: revs,
      media_assets: [],
      website_enquiries: [],
      seo_audits: [],
      seo_issues: [],
      pagespeed_reports: [],
      ai_reports: [],
      ai_tasks: [],
      system_settings: {},
    } satisfies PlatformLocalStore;
  }
  return g[PLATFORM_LOCAL_KEY] as PlatformLocalStore;
}

function getD1Drizzle() {
  const d1 = getD1Database();
  return d1 ? drizzle(d1, { schema }) : null;
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function ensureSeededD1(db: NonNullable<ReturnType<typeof getD1Drizzle>>) {
  const existing = await db
    .select({ id: schema.cmsDocuments.id })
    .from(schema.cmsDocuments)
    .limit(1)
    .all();
  if (existing.length > 0) return;

  const { docs, revs } = buildInitialDocuments();
  for (const d of docs) {
    await db
      .insert(schema.cmsDocuments)
      .values({
        id: d.id,
        sanityId: d.sanity_id,
        docType: d.doc_type,
        slug: d.slug,
        title: d.title,
        summary: d.summary,
        category: d.category,
        status: d.status,
        sortOrder: d.sort_order,
        payloadJson: JSON.stringify(d.payload),
        seoJson: JSON.stringify(d.seo),
        scheduledAt: d.scheduled_at,
        publishedAt: d.published_at,
        sanitySyncedAt: d.sanity_synced_at,
        updatedBy: d.updated_by,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      })
      .onConflictDoNothing();
  }
  for (const r of revs) {
    await db
      .insert(schema.cmsRevisions)
      .values({
        id: r.id,
        documentId: r.document_id,
        version: r.version,
        title: r.title,
        status: r.status,
        snapshotJson: JSON.stringify(r.snapshot),
        changeSummary: r.change_summary,
        action: r.action,
        editorId: r.editor_id,
        editorLabel: r.editor_label,
        createdAt: r.created_at,
      })
      .onConflictDoNothing();
  }
}

function mapCmsRow(r: typeof schema.cmsDocuments.$inferSelect): CmsDocumentRecord {
  return {
    id: r.id,
    sanity_id: r.sanityId ?? null,
    doc_type: r.docType,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    category: r.category,
    status: r.status,
    sort_order: r.sortOrder,
    payload: safeJsonParse(r.payloadJson, {}),
    seo: safeJsonParse(r.seoJson, {}),
    scheduled_at: r.scheduledAt ?? null,
    published_at: r.publishedAt ?? null,
    sanity_synced_at: r.sanitySyncedAt ?? null,
    updated_by: r.updatedBy ?? null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

// ============================================================================
// CMS Documents & Revisions
// ============================================================================

export async function listCmsDocuments(opts?: {
  docTypes?: CmsDocType[];
  status?: CmsStatus;
}): Promise<CmsDocumentRecord[]> {
  const db = getD1Drizzle();
  if (!db) {
    return getPlatformStore()
      .cms_documents.filter(
        (d) =>
          (!opts?.docTypes?.length || opts.docTypes.includes(d.doc_type)) &&
          (!opts?.status || d.status === opts.status),
      )
      .sort((a, b) => a.sort_order - b.sort_order || b.updated_at.localeCompare(a.updated_at));
  }
  await ensureSeededD1(db);
  const conditions = [];
  if (opts?.docTypes?.length) conditions.push(inArray(schema.cmsDocuments.docType, opts.docTypes));
  if (opts?.status) conditions.push(eq(schema.cmsDocuments.status, opts.status));
  const query = db.select().from(schema.cmsDocuments);
  const rows = await (conditions.length ? query.where(and(...conditions)) : query)
    .orderBy(schema.cmsDocuments.sortOrder, desc(schema.cmsDocuments.updatedAt))
    .all();
  return rows.map(mapCmsRow);
}

export async function getCmsDocumentById(id: string): Promise<CmsDocumentRecord | null> {
  const db = getD1Drizzle();
  if (!db) return getPlatformStore().cms_documents.find((d) => d.id === id) ?? null;
  await ensureSeededD1(db);
  const row = await db
    .select()
    .from(schema.cmsDocuments)
    .where(eq(schema.cmsDocuments.id, id))
    .get();
  return row ? mapCmsRow(row) : null;
}

export async function upsertCmsDocument(input: {
  id?: string | undefined;
  sanity_id?: string | null | undefined;
  doc_type: CmsDocType;
  slug: string;
  title: string;
  summary: string;
  category?: string | undefined;
  status: CmsStatus;
  sort_order?: number | undefined;
  payload: Record<string, JsonValue | undefined>;
  seo: CmsSeoFields;
  scheduled_at?: string | null | undefined;
  sanity_synced_at?: string | null | undefined;
  editor_id: string;
  editor_label: string;
  change_summary: string;
  action: "draft_saved" | "published" | "unpublished" | "archived" | "restored";
}): Promise<CmsDocumentRecord> {
  const now = new Date().toISOString();
  const id = input.id || `doc-${input.doc_type}-${randomUUID().slice(0, 8)}`;
  const existing = await getCmsDocumentById(id);

  const doc: CmsDocumentRecord = {
    id,
    sanity_id: input.sanity_id ?? existing?.sanity_id ?? null,
    doc_type: input.doc_type,
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    category: input.category ?? existing?.category ?? "",
    status: input.status,
    sort_order: input.sort_order ?? existing?.sort_order ?? 100,
    payload: input.payload,
    seo: input.seo,
    scheduled_at: input.scheduled_at ?? null,
    published_at:
      input.status === "published"
        ? (existing?.published_at ?? now)
        : (existing?.published_at ?? null),
    sanity_synced_at: input.sanity_synced_at ?? existing?.sanity_synced_at ?? null,
    updated_by: input.editor_label,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  const revs = await listCmsRevisions(id);
  const nextVersion = (revs[0]?.version ?? 0) + 1;
  const revision: CmsRevisionRecord = {
    id: randomUUID(),
    document_id: id,
    version: nextVersion,
    title: doc.title,
    status: doc.status,
    snapshot: {
      title: doc.title,
      summary: doc.summary,
      category: doc.category,
      slug: doc.slug,
      payload: doc.payload,
      seo: { ...doc.seo },
    },
    change_summary: input.change_summary,
    action: input.action,
    editor_id: input.editor_id,
    editor_label: input.editor_label,
    created_at: now,
  };

  const db = getD1Drizzle();
  if (!db) {
    const store = getPlatformStore();
    const idx = store.cms_documents.findIndex((d) => d.id === id);
    if (idx >= 0) store.cms_documents[idx] = doc;
    else store.cms_documents.push(doc);
    store.cms_revisions.unshift(revision);
    return doc;
  }

  await ensureSeededD1(db);
  await db
    .insert(schema.cmsDocuments)
    .values({
      id: doc.id,
      sanityId: doc.sanity_id,
      docType: doc.doc_type,
      slug: doc.slug,
      title: doc.title,
      summary: doc.summary,
      category: doc.category,
      status: doc.status,
      sortOrder: doc.sort_order,
      payloadJson: JSON.stringify(doc.payload),
      seoJson: JSON.stringify(doc.seo),
      scheduledAt: doc.scheduled_at,
      publishedAt: doc.published_at,
      sanitySyncedAt: doc.sanity_synced_at,
      updatedBy: doc.updated_by,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    })
    .onConflictDoUpdate({
      target: schema.cmsDocuments.id,
      set: {
        sanityId: doc.sanity_id,
        slug: doc.slug,
        title: doc.title,
        summary: doc.summary,
        category: doc.category,
        status: doc.status,
        sortOrder: doc.sort_order,
        payloadJson: JSON.stringify(doc.payload),
        seoJson: JSON.stringify(doc.seo),
        scheduledAt: doc.scheduled_at,
        publishedAt: doc.published_at,
        sanitySyncedAt: doc.sanity_synced_at,
        updatedBy: doc.updated_by,
        updatedAt: doc.updated_at,
      },
    });

  await db.insert(schema.cmsRevisions).values({
    id: revision.id,
    documentId: revision.document_id,
    version: revision.version,
    title: revision.title,
    status: revision.status,
    snapshotJson: JSON.stringify(revision.snapshot),
    changeSummary: revision.change_summary,
    action: revision.action,
    editorId: revision.editor_id,
    editorLabel: revision.editor_label,
    createdAt: revision.created_at,
  });

  return doc;
}

export async function deleteCmsDocument(id: string): Promise<void> {
  const db = getD1Drizzle();
  if (!db) {
    const store = getPlatformStore();
    store.cms_documents = store.cms_documents.filter((d) => d.id !== id);
    store.cms_revisions = store.cms_revisions.filter((r) => r.document_id !== id);
    return;
  }
  await db.delete(schema.cmsDocuments).where(eq(schema.cmsDocuments.id, id));
}

export async function listCmsRevisions(
  documentId?: string,
  limit = 200,
): Promise<CmsRevisionRecord[]> {
  const db = getD1Drizzle();
  if (!db) {
    return getPlatformStore()
      .cms_revisions.filter((r) => !documentId || r.document_id === documentId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.version - a.version)
      .slice(0, limit);
  }
  await ensureSeededD1(db);
  const query = db.select().from(schema.cmsRevisions);
  const rows = await (
    documentId ? query.where(eq(schema.cmsRevisions.documentId, documentId)) : query
  )
    .orderBy(desc(schema.cmsRevisions.createdAt))
    .limit(limit)
    .all();

  return rows.map((r) => ({
    id: r.id,
    document_id: r.documentId,
    version: r.version,
    title: r.title,
    status: r.status,
    snapshot: safeJsonParse(r.snapshotJson, {}),
    change_summary: r.changeSummary,
    action: r.action,
    editor_id: r.editorId ?? null,
    editor_label: r.editorLabel ?? null,
    created_at: r.createdAt,
  }));
}

export async function getCmsRevisionById(id: string): Promise<CmsRevisionRecord | null> {
  const revs = await listCmsRevisions(undefined, 500);
  return revs.find((r) => r.id === id) ?? null;
}

// ============================================================================
// Media Assets Metadata & Reference Checks
// ============================================================================

export async function listStoredMediaAssets(): Promise<MediaAssetRecord[]> {
  const db = getD1Drizzle();
  if (!db) {
    return [...getPlatformStore().media_assets].sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    );
  }
  const rows = await db
    .select()
    .from(schema.mediaAssets)
    .orderBy(desc(schema.mediaAssets.updatedAt))
    .all();
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    asset_key: r.assetKey,
    url: r.url,
    filename: r.filename,
    mime_type: r.mimeType,
    width: r.width ?? null,
    height: r.height ?? null,
    size_bytes: r.sizeBytes ?? null,
    alt_text: r.altText,
    caption: r.caption,
    folder: r.folder,
    data_url: r.dataUrl ?? null,
    uploaded_by: r.uploadedBy ?? null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }));
}

export async function upsertMediaAsset(input: {
  source: "sanity" | "github" | "d1";
  asset_key: string;
  url: string;
  filename: string;
  mime_type?: string;
  width?: number | null;
  height?: number | null;
  size_bytes?: number | null;
  alt_text?: string;
  caption?: string;
  folder?: string;
  data_url?: string | null;
  uploaded_by?: string | null;
}): Promise<MediaAssetRecord> {
  const now = new Date().toISOString();
  const db = getD1Drizzle();
  if (!db) {
    const store = getPlatformStore();
    const existing = store.media_assets.find((m) => m.asset_key === input.asset_key);
    if (existing) {
      Object.assign(existing, {
        ...input,
        alt_text: input.alt_text ?? existing.alt_text,
        caption: input.caption ?? existing.caption,
        folder: input.folder ?? existing.folder,
        updated_at: now,
      });
      return existing;
    }
    const created: MediaAssetRecord = {
      id: randomUUID(),
      source: input.source,
      asset_key: input.asset_key,
      url: input.url,
      filename: input.filename,
      mime_type: input.mime_type ?? "image/webp",
      width: input.width ?? null,
      height: input.height ?? null,
      size_bytes: input.size_bytes ?? null,
      alt_text: input.alt_text ?? "",
      caption: input.caption ?? "",
      folder: input.folder ?? "general",
      data_url: input.data_url ?? null,
      uploaded_by: input.uploaded_by ?? null,
      created_at: now,
      updated_at: now,
    };
    store.media_assets.unshift(created);
    return created;
  }

  const existing = await db
    .select()
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.assetKey, input.asset_key))
    .get();

  const id = existing?.id ?? randomUUID();
  const record: MediaAssetRecord = {
    id,
    source: input.source,
    asset_key: input.asset_key,
    url: input.url,
    filename: input.filename,
    mime_type: input.mime_type ?? existing?.mimeType ?? "image/webp",
    width: input.width ?? existing?.width ?? null,
    height: input.height ?? existing?.height ?? null,
    size_bytes: input.size_bytes ?? existing?.sizeBytes ?? null,
    alt_text: input.alt_text ?? existing?.altText ?? "",
    caption: input.caption ?? existing?.caption ?? "",
    folder: input.folder ?? existing?.folder ?? "general",
    data_url: input.data_url ?? existing?.dataUrl ?? null,
    uploaded_by: input.uploaded_by ?? existing?.uploadedBy ?? null,
    created_at: existing?.createdAt ?? now,
    updated_at: now,
  };

  await db
    .insert(schema.mediaAssets)
    .values({
      id: record.id,
      source: record.source,
      assetKey: record.asset_key,
      url: record.url,
      filename: record.filename,
      mimeType: record.mime_type,
      width: record.width,
      height: record.height,
      sizeBytes: record.size_bytes,
      altText: record.alt_text,
      caption: record.caption,
      folder: record.folder,
      dataUrl: record.data_url,
      uploadedBy: record.uploaded_by,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    })
    .onConflictDoUpdate({
      target: schema.mediaAssets.assetKey,
      set: {
        url: record.url,
        altText: record.alt_text,
        caption: record.caption,
        folder: record.folder,
        updatedAt: record.updated_at,
      },
    });
  return record;
}

export async function getMediaReferencesCount(urlOrKey: string): Promise<number> {
  const docs = await listCmsDocuments();
  let count = 0;
  for (const d of docs) {
    const serialized = JSON.stringify({ payload: d.payload, seo: d.seo });
    if (serialized.includes(urlOrKey)) count += 1;
  }
  return count;
}

export async function deleteStoredMediaAsset(assetKey: string): Promise<void> {
  const db = getD1Drizzle();
  if (!db) {
    const store = getPlatformStore();
    store.media_assets = store.media_assets.filter((m) => m.asset_key !== assetKey);
    return;
  }
  await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.assetKey, assetKey));
}

// ============================================================================
// Enquiries
// ============================================================================

export async function listEnquiries(opts?: {
  status?: EnquiryRecord["status"];
}): Promise<EnquiryRecord[]> {
  const db = getD1Drizzle();
  if (!db) {
    return getPlatformStore()
      .website_enquiries.filter((e) => !opts?.status || e.status === opts.status)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const query = db.select().from(schema.websiteEnquiries);
  const rows = await (
    opts?.status ? query.where(eq(schema.websiteEnquiries.status, opts.status)) : query
  )
    .orderBy(desc(schema.websiteEnquiries.createdAt))
    .all();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    business: r.business,
    email: r.email,
    phone: r.phone,
    service: r.service,
    subject: r.subject,
    message: r.message,
    source_page: r.sourcePage,
    status: r.status,
    is_read: Boolean(r.isRead),
    assigned_to: r.assignedTo ?? null,
    category: r.category,
    internal_notes: r.internalNotes,
    requester_ip: r.requesterIp ?? null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }));
}

export async function createEnquiry(input: {
  name: string;
  business?: string;
  email: string;
  phone?: string;
  service?: string;
  subject?: string;
  message: string;
  source_page?: string;
  category?: string;
  requester_ip?: string | null;
}): Promise<EnquiryRecord> {
  const now = new Date().toISOString();
  const record: EnquiryRecord = {
    id: randomUUID(),
    name: input.name,
    business: input.business ?? "",
    email: input.email.trim().toLowerCase(),
    phone: input.phone ?? "",
    service: input.service ?? "",
    subject: input.subject ?? "",
    message: input.message,
    source_page: input.source_page ?? "/contact",
    status: "new",
    is_read: false,
    assigned_to: null,
    category: input.category ?? "general",
    internal_notes: "",
    requester_ip: input.requester_ip ?? null,
    created_at: now,
    updated_at: now,
  };
  const db = getD1Drizzle();
  if (!db) {
    getPlatformStore().website_enquiries.unshift(record);
    return record;
  }
  await db.insert(schema.websiteEnquiries).values({
    id: record.id,
    name: record.name,
    business: record.business,
    email: record.email,
    phone: record.phone,
    service: record.service,
    subject: record.subject,
    message: record.message,
    sourcePage: record.source_page,
    status: record.status,
    isRead: 0,
    assignedTo: null,
    category: record.category,
    internalNotes: "",
    requesterIp: record.requester_ip,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  });
  return record;
}

export async function updateEnquiry(
  id: string,
  patch: {
    status?: EnquiryRecord["status"] | undefined;
    is_read?: boolean | undefined;
    assigned_to?: string | null | undefined;
    category?: string | undefined;
    internal_notes?: string | undefined;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const db = getD1Drizzle();
  if (!db) {
    const item = getPlatformStore().website_enquiries.find((e) => e.id === id);
    if (item) Object.assign(item, patch, { updated_at: now });
    return;
  }
  await db
    .update(schema.websiteEnquiries)
    .set({
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.is_read !== undefined ? { isRead: patch.is_read ? 1 : 0 } : {}),
      ...(patch.assigned_to !== undefined ? { assignedTo: patch.assigned_to } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.internal_notes !== undefined ? { internalNotes: patch.internal_notes } : {}),
      updatedAt: now,
    })
    .where(eq(schema.websiteEnquiries.id, id));
}

// ============================================================================
// SEO Audits & Issues
// ============================================================================

export async function saveSeoCrawlResults(
  audits: Array<Omit<SeoAuditRecord, "id">>,
  issues: Array<{
    page_path: string;
    url: string;
    severity: "error" | "warning" | "info";
    code: string;
    title: string;
    explanation: string;
    suggested_fix: string;
  }>,
): Promise<void> {
  const now = new Date().toISOString();
  const db = getD1Drizzle();

  if (!db) {
    const store = getPlatformStore();
    for (const a of audits) {
      store.seo_audits = store.seo_audits.filter((x) => x.page_path !== a.page_path);
      store.seo_audits.push({ id: randomUUID(), ...a });
    }
    // Reconcile open issues cleanly: replace open issues with newly scanned issues while preserving resolved/ignored history
    const preserved = store.seo_issues.filter((i) => i.status !== "open");
    const newOpen: SeoIssueRecord[] = issues.map((i) => ({
      id: randomUUID(),
      ...i,
      status: "open",
      resolved_by: null,
      resolved_at: null,
      created_at: now,
      updated_at: now,
    }));
    store.seo_issues = [...newOpen, ...preserved];
    return;
  }

  for (const a of audits) {
    await db.delete(schema.seoAudits).where(eq(schema.seoAudits.pagePath, a.page_path));
    await db.insert(schema.seoAudits).values({
      id: randomUUID(),
      url: a.url,
      pagePath: a.page_path,
      statusCode: a.status_code,
      title: a.title,
      metaDescription: a.meta_description,
      canonicalUrl: a.canonical_url,
      robotsMeta: a.robots_meta,
      ogTitle: a.og_title,
      ogDescription: a.og_description,
      ogImage: a.og_image,
      h1Count: a.h1_count,
      h1Text: a.h1_text,
      hasJsonLd: a.has_json_ld ? 1 : 0,
      jsonLdTypesJson: JSON.stringify(a.json_ld_types),
      hasGa4Tag: a.has_ga4_tag ? 1 : 0,
      ga4MeasurementId: a.ga4_measurement_id,
      brokenLinksJson: JSON.stringify(a.broken_links),
      issuesJson: JSON.stringify(a.issues),
      responseMs: a.response_ms,
      checkedAt: a.checked_at,
    });
  }

  await db.delete(schema.seoIssues).where(eq(schema.seoIssues.status, "open"));
  for (const i of issues) {
    await db.insert(schema.seoIssues).values({
      id: randomUUID(),
      pagePath: i.page_path,
      url: i.url,
      severity: i.severity,
      code: i.code,
      title: i.title,
      explanation: i.explanation,
      suggestedFix: i.suggested_fix,
      status: "open",
      resolvedBy: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function listLatestSeoAudits(): Promise<SeoAuditRecord[]> {
  const db = getD1Drizzle();
  if (!db) {
    return [...getPlatformStore().seo_audits].sort((a, b) =>
      a.page_path.localeCompare(b.page_path),
    );
  }
  const rows = await db.select().from(schema.seoAudits).orderBy(schema.seoAudits.pagePath).all();
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    page_path: r.pagePath,
    status_code: r.statusCode,
    title: r.title,
    meta_description: r.metaDescription,
    canonical_url: r.canonicalUrl,
    robots_meta: r.robotsMeta,
    og_title: r.ogTitle,
    og_description: r.ogDescription,
    og_image: r.ogImage,
    h1_count: r.h1Count,
    h1_text: r.h1Text,
    has_json_ld: Boolean(r.hasJsonLd),
    json_ld_types: safeJsonParse(r.jsonLdTypesJson, []),
    has_ga4_tag: Boolean(r.hasGa4Tag),
    ga4_measurement_id: r.ga4MeasurementId ?? null,
    broken_links: safeJsonParse(r.brokenLinksJson, []),
    issues: safeJsonParse(r.issuesJson, []),
    response_ms: r.responseMs,
    checked_at: r.checkedAt,
  }));
}

export async function listSeoIssues(): Promise<SeoIssueRecord[]> {
  const db = getD1Drizzle();
  if (!db) return [...getPlatformStore().seo_issues];
  const rows = await db
    .select()
    .from(schema.seoIssues)
    .orderBy(desc(schema.seoIssues.updatedAt))
    .all();
  return rows.map((r) => ({
    id: r.id,
    page_path: r.pagePath,
    url: r.url,
    severity: r.severity,
    code: r.code,
    title: r.title,
    explanation: r.explanation,
    suggested_fix: r.suggestedFix,
    status: r.status,
    resolved_by: r.resolvedBy ?? null,
    resolved_at: r.resolvedAt ?? null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }));
}

export async function updateSeoIssueStatus(
  id: string,
  status: "open" | "resolved" | "ignored",
  actorLabel: string,
): Promise<void> {
  const now = new Date().toISOString();
  const db = getD1Drizzle();
  if (!db) {
    const item = getPlatformStore().seo_issues.find((i) => i.id === id);
    if (item) {
      item.status = status;
      item.resolved_by = status === "open" ? null : actorLabel;
      item.resolved_at = status === "open" ? null : now;
      item.updated_at = now;
    }
    return;
  }
  await db
    .update(schema.seoIssues)
    .set({
      status,
      resolvedBy: status === "open" ? null : actorLabel,
      resolvedAt: status === "open" ? null : now,
      updatedAt: now,
    })
    .where(eq(schema.seoIssues.id, id));
}

// ============================================================================
// PageSpeed Reports
// ============================================================================

export async function savePageSpeedReport(
  report: Omit<PageSpeedReportRecord, "id" | "created_at">,
): Promise<PageSpeedReportRecord> {
  const rec: PageSpeedReportRecord = {
    id: randomUUID(),
    ...report,
    created_at: new Date().toISOString(),
  };
  const db = getD1Drizzle();
  if (!db) {
    getPlatformStore().pagespeed_reports.unshift(rec);
    return rec;
  }
  await db.insert(schema.pagespeedReports).values({
    id: rec.id,
    url: rec.url,
    strategy: rec.strategy,
    performanceScore: rec.performance_score,
    accessibilityScore: rec.accessibility_score,
    bestPracticesScore: rec.best_practices_score,
    seoScore: rec.seo_score,
    lcpMs: rec.lcp_ms,
    inpMs: rec.inp_ms,
    clsScore: rec.cls_score,
    fcpMs: rec.fcp_ms,
    ttfbMs: rec.ttfb_ms,
    fieldLcpMs: rec.field_lcp_ms,
    fieldInpMs: rec.field_inp_ms,
    fieldCls: rec.field_cls,
    opportunitiesJson: JSON.stringify(rec.opportunities),
    auditsJson: JSON.stringify(rec.audits),
    error: rec.error,
    createdAt: rec.created_at,
  });
  return rec;
}

export async function listPageSpeedReports(limit = 50): Promise<PageSpeedReportRecord[]> {
  const db = getD1Drizzle();
  if (!db) return getPlatformStore().pagespeed_reports.slice(0, limit);
  const rows = await db
    .select()
    .from(schema.pagespeedReports)
    .orderBy(desc(schema.pagespeedReports.createdAt))
    .limit(limit)
    .all();
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    strategy: r.strategy,
    performance_score: r.performanceScore ?? null,
    accessibility_score: r.accessibilityScore ?? null,
    best_practices_score: r.bestPracticesScore ?? null,
    seo_score: r.seoScore ?? null,
    lcp_ms: r.lcpMs ?? null,
    inp_ms: r.inpMs ?? null,
    cls_score: r.clsScore ?? null,
    fcp_ms: r.fcpMs ?? null,
    ttfb_ms: r.ttfbMs ?? null,
    field_lcp_ms: r.fieldLcpMs ?? null,
    field_inp_ms: r.fieldInpMs ?? null,
    field_cls: r.fieldCls ?? null,
    opportunities: safeJsonParse(r.opportunitiesJson, []),
    audits: safeJsonParse(r.auditsJson, []),
    error: r.error ?? null,
    created_at: r.createdAt,
  }));
}

// ============================================================================
// AI Reports & Priority Tasks
// ============================================================================

export async function saveAiReport(
  report: Omit<AiReportRecord, "id" | "created_at">,
): Promise<AiReportRecord> {
  const rec: AiReportRecord = {
    id: randomUUID(),
    ...report,
    created_at: new Date().toISOString(),
  };
  const db = getD1Drizzle();
  if (!db) {
    getPlatformStore().ai_reports.unshift(rec);
    return rec;
  }
  await db.insert(schema.aiReports).values({
    id: rec.id,
    reportType: rec.report_type,
    title: rec.title,
    summary: rec.summary,
    provider: rec.provider,
    groundedSignalsJson: JSON.stringify(rec.grounded_signals),
    recommendationsJson: JSON.stringify(rec.recommendations),
    createdBy: rec.created_by,
    createdAt: rec.created_at,
  });
  return rec;
}

export async function listAiReports(limit = 30): Promise<AiReportRecord[]> {
  const db = getD1Drizzle();
  if (!db) return getPlatformStore().ai_reports.slice(0, limit);
  const rows = await db
    .select()
    .from(schema.aiReports)
    .orderBy(desc(schema.aiReports.createdAt))
    .limit(limit)
    .all();
  return rows.map((r) => ({
    id: r.id,
    report_type: r.reportType,
    title: r.title,
    summary: r.summary,
    provider: r.provider,
    grounded_signals: safeJsonParse(r.groundedSignalsJson, {}),
    recommendations: safeJsonParse(r.recommendationsJson, []),
    created_by: r.createdBy ?? null,
    created_at: r.createdAt,
  }));
}

export async function listAiTasks(): Promise<AiTaskRecord[]> {
  const db = getD1Drizzle();
  if (!db) {
    return [...getPlatformStore().ai_tasks].sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    );
  }
  const rows = await db.select().from(schema.aiTasks).orderBy(desc(schema.aiTasks.updatedAt)).all();
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    priority: r.priority,
    source: r.source,
    related_url: r.relatedUrl,
    status: r.status,
    assigned_to: r.assignedTo ?? null,
    created_by: r.createdBy ?? null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }));
}

export async function createAiTask(input: {
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  source: "seo" | "performance" | "ai" | "system";
  related_url?: string;
  created_by: string;
}): Promise<AiTaskRecord> {
  const now = new Date().toISOString();
  const rec: AiTaskRecord = {
    id: randomUUID(),
    title: input.title,
    description: input.description ?? "",
    priority: input.priority,
    source: input.source,
    related_url: input.related_url ?? "",
    status: "open",
    assigned_to: null,
    created_by: input.created_by,
    created_at: now,
    updated_at: now,
  };
  const db = getD1Drizzle();
  if (!db) {
    getPlatformStore().ai_tasks.unshift(rec);
    return rec;
  }
  await db.insert(schema.aiTasks).values({
    id: rec.id,
    title: rec.title,
    description: rec.description,
    priority: rec.priority,
    source: rec.source,
    relatedUrl: rec.related_url,
    status: rec.status,
    assignedTo: null,
    createdBy: rec.created_by,
    createdAt: rec.created_at,
    updatedAt: rec.updated_at,
  });
  return rec;
}

export async function updateAiTask(
  id: string,
  patch: {
    status?: AiTaskRecord["status"] | undefined;
    priority?: AiTaskRecord["priority"] | undefined;
    assigned_to?: string | null | undefined;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const db = getD1Drizzle();
  if (!db) {
    const item = getPlatformStore().ai_tasks.find((t) => t.id === id);
    if (item) Object.assign(item, patch, { updated_at: now });
    return;
  }
  await db
    .update(schema.aiTasks)
    .set({
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.assigned_to !== undefined ? { assignedTo: patch.assigned_to } : {}),
      updatedAt: now,
    })
    .where(eq(schema.aiTasks.id, id));
}

export async function deleteAiTask(id: string): Promise<void> {
  const db = getD1Drizzle();
  if (!db) {
    const store = getPlatformStore();
    store.ai_tasks = store.ai_tasks.filter((t) => t.id !== id);
    return;
  }
  await db.delete(schema.aiTasks).where(eq(schema.aiTasks.id, id));
}

// ============================================================================
// System Settings
// ============================================================================

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const db = getD1Drizzle();
  if (!db) {
    const row = getPlatformStore().system_settings["platform"];
    return row
      ? { ...DEFAULT_PLATFORM_SETTINGS, ...(row.value as Partial<PlatformSettings>) }
      : DEFAULT_PLATFORM_SETTINGS;
  }
  const row = await db
    .select()
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, "platform"))
    .get();
  if (!row) return DEFAULT_PLATFORM_SETTINGS;
  return {
    ...DEFAULT_PLATFORM_SETTINGS,
    ...safeJsonParse<Partial<PlatformSettings>>(row.valueJson, {}),
  };
}

export async function savePlatformSettings(
  patch: Partial<PlatformSettings>,
  updatedBy: string,
): Promise<PlatformSettings> {
  const current = await getPlatformSettings();
  const next: PlatformSettings = { ...current, ...patch };
  const now = new Date().toISOString();
  const db = getD1Drizzle();
  if (!db) {
    getPlatformStore().system_settings["platform"] = {
      value: next,
      updated_by: updatedBy,
      updated_at: now,
    };
    return next;
  }
  await db
    .insert(schema.systemSettings)
    .values({
      key: "platform",
      valueJson: JSON.stringify(next),
      updatedBy,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.systemSettings.key,
      set: {
        valueJson: JSON.stringify(next),
        updatedBy,
        updatedAt: now,
      },
    });
  return next;
}
