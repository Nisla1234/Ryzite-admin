import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "./auth-middleware";
import { LIVE_SITE_URL } from "./nav";
import { can, type Permission, type Role } from "./permissions";
import type { JsonValue } from "./session";

function assertPermission(roles: Role[], permission: Permission) {
  if (!can(roles, permission)) {
    throw new Error(`Forbidden: Missing permission ${permission}.`);
  }
}

const docTypeEnum = z.enum([
  "page",
  "portfolio",
  "service",
  "solution",
  "team",
  "article",
  "testimonial",
  "navigation",
  "seo_override",
]);

const statusEnum = z.enum(["draft", "scheduled", "published", "archived"]);

// ============================================================================
// Executive Dashboard & Overview
// ============================================================================

export const getExecutiveOverview = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    assertPermission(context.roles, "dashboard.view");
    const [
      { countPendingAccessRequests, countProfiles, listAuditLogs },
      { listAiTasks, listEnquiries, listLatestSeoAudits, listPageSpeedReports, listSeoIssues },
      { fetchGa4Analytics },
    ] = await Promise.all([
      import("./db.server"),
      import("./platform-db.server"),
      import("./platform-services.server"),
    ]);

    const isSuper = can(context.roles, "access.review");
    const [
      activity,
      members,
      pendingAccess,
      enquiries,
      seoAudits,
      seoIssues,
      speedReports,
      aiTasks,
      ga4,
    ] = await Promise.all([
      listAuditLogs({ limit: 8 }),
      countProfiles(),
      isSuper ? countPendingAccessRequests() : Promise.resolve(null),
      listEnquiries(),
      listLatestSeoAudits(),
      listSeoIssues(),
      listPageSpeedReports(10),
      listAiTasks(),
      fetchGa4Analytics(28),
    ]);

    const latestMobileSpeed = speedReports.find((r) => r.strategy === "mobile" && !r.error) ?? null;
    const latestDesktopSpeed =
      speedReports.find((r) => r.strategy === "desktop" && !r.error) ?? null;
    const openIssues = seoIssues.filter((i) => i.status === "open");
    const openEnquiries = enquiries.filter((e) => e.status === "new" || e.status === "in_review");
    const unreadEnquiries = enquiries.filter((e) => !e.is_read && e.status !== "archived");

    return {
      activity: activity.map((a) => ({
        id: a.id,
        action: a.action,
        actor_label: a.actor_label,
        subject: a.subject,
        result: a.result,
        created_at: a.created_at,
      })),
      members,
      pendingAccess,
      enquiriesCount: enquiries.length,
      openEnquiriesCount: openEnquiries.length,
      unreadEnquiriesCount: unreadEnquiries.length,
      seoSummary: {
        pagesCrawled: seoAudits.length,
        lastCheckedAt: seoAudits[0]?.checked_at ?? null,
        openErrors: openIssues.filter((i) => i.severity === "error").length,
        openWarnings: openIssues.filter((i) => i.severity === "warning").length,
        topIssues: openIssues.slice(0, 6),
      },
      performance: {
        mobile: latestMobileSpeed,
        desktop: latestDesktopSpeed,
      },
      ga4:
        ga4.configured && !("error" in ga4)
          ? {
              connected: true as const,
              tagInstalled: ga4.tagInstalled,
              measurementId: ga4.measurementId,
              summary: ga4.summary,
              fetchedAt: ga4.fetchedAt,
            }
          : {
              connected: false as const,
              tagInstalled: ga4.tagInstalled,
              measurementId: ga4.measurementId,
              missing: ga4.missing,
              error: "error" in ga4 ? ga4.error : undefined,
              fetchedAt: ga4.fetchedAt,
            },
      tasks: {
        openCount: aiTasks.filter((t) => t.status === "open" || t.status === "in_progress").length,
        items: aiTasks.filter((t) => t.status !== "done" && t.status !== "dismissed").slice(0, 5),
      },
    };
  });

// ============================================================================
// Website Management (CMS Documents, Versions, Media, Enquiries)
// ============================================================================

export const getCmsCollection = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z.object({ docTypes: z.array(docTypeEnum).min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "content.edit");
    const [{ listCmsDocuments }, { fetchSanitySummaryAndAssets }] = await Promise.all([
      import("./platform-db.server"),
      import("./platform-services.server"),
    ]);
    const [documents, sanity] = await Promise.all([
      listCmsDocuments({ docTypes: data.docTypes }),
      fetchSanitySummaryAndAssets(),
    ]);
    return {
      documents,
      sanity: {
        reachable: sanity.reachable,
        hasWriteToken: sanity.hasWriteToken,
        docsCount: sanity.docsCount,
        error: sanity.error,
      },
    };
  });

export const saveCmsDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().optional(),
        doc_type: docTypeEnum,
        slug: z.string().trim().min(1).max(200),
        title: z.string().trim().min(1).max(200),
        summary: z.string().max(2000).default(""),
        category: z.string().max(120).default(""),
        status: statusEnum,
        sort_order: z.number().int().min(0).max(9999).optional(),
        payload: z
          .record(z.string(), z.unknown())
          .default({})
          .transform((val) => val as Record<string, JsonValue | undefined>),
        seo: z
          .object({
            seoTitle: z.string().max(200).optional(),
            metaDescription: z.string().max(500).optional(),
            canonicalUrl: z.string().max(300).optional(),
            robots: z.string().max(100).optional(),
            ogTitle: z.string().max(200).optional(),
            ogDescription: z.string().max(500).optional(),
            ogImage: z.string().max(500).optional(),
            jsonLd: z.string().max(8000).optional(),
          })
          .default({}),
        scheduled_at: z.string().nullable().optional(),
        change_summary: z.string().max(300).default("Updated content"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "content.edit");
    if (data.status === "published" || data.status === "archived" || data.status === "scheduled") {
      assertPermission(context.roles, "content.publish");
    }

    if (data.seo.jsonLd && data.seo.jsonLd.trim()) {
      try {
        JSON.parse(data.seo.jsonLd);
      } catch {
        return { ok: false as const, error: "Structured Data JSON-LD must be valid JSON." };
      }
    }

    const [{ actorLabel, writeAudit }, { upsertCmsDocument }, { pushDocumentToSanity }] =
      await Promise.all([
        import("./audit.server"),
        import("./platform-db.server"),
        import("./platform-services.server"),
      ]);

    const label = (await actorLabel(context.userId)) ?? "admin";
    const action =
      data.status === "published"
        ? ("published" as const)
        : data.status === "archived"
          ? ("archived" as const)
          : ("draft_saved" as const);

    const saved = await upsertCmsDocument({
      id: data.id,
      doc_type: data.doc_type,
      slug: data.slug,
      title: data.title,
      summary: data.summary,
      category: data.category,
      status: data.status,
      sort_order: data.sort_order,
      payload: data.payload,
      seo: data.seo,
      scheduled_at: data.scheduled_at ?? null,
      editor_id: context.userId,
      editor_label: label,
      change_summary: data.change_summary,
      action,
    });

    const sanityRes = await pushDocumentToSanity(saved, data.status === "published");
    if (sanityRes.synced && sanityRes.sanityId) {
      await upsertCmsDocument({
        id: saved.id,
        sanity_id: sanityRes.sanityId,
        sanity_synced_at: new Date().toISOString(),
        doc_type: saved.doc_type,
        slug: saved.slug,
        title: saved.title,
        summary: saved.summary,
        category: saved.category,
        status: saved.status,
        sort_order: saved.sort_order,
        payload: saved.payload,
        seo: saved.seo,
        scheduled_at: saved.scheduled_at,
        editor_id: context.userId,
        editor_label: label,
        change_summary: "Synced to Sanity CMS",
        action,
      });
    }

    await writeAudit({
      category: "activity",
      action: data.status === "published" ? "cms.published" : "cms.saved",
      actorId: context.userId,
      actorLabel: label,
      entityType: data.doc_type,
      entityId: saved.id,
      subject: saved.title,
      metadata: {
        slug: saved.slug,
        status: saved.status,
        sanitySynced: sanityRes.synced,
      },
    });

    return { ok: true as const, document: saved, sanity: sanityRes };
  });

export const deleteCmsDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "content.publish");
    const [{ actorLabel, writeAudit }, { deleteCmsDocument, getCmsDocumentById }] =
      await Promise.all([import("./audit.server"), import("./platform-db.server")]);
    const existing = await getCmsDocumentById(data.id);
    if (!existing) return { ok: false as const, error: "Document not found." };
    await deleteCmsDocument(data.id);
    await writeAudit({
      category: "activity",
      action: "cms.deleted",
      actorId: context.userId,
      actorLabel: await actorLabel(context.userId),
      entityType: existing.doc_type,
      entityId: existing.id,
      subject: existing.title,
    });
    return { ok: true as const };
  });

export const getVersionHistoryFn = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z.object({ documentId: z.string().optional() }).optional().parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "content.edit");
    const { listCmsDocuments, listCmsRevisions } = await import("./platform-db.server");
    const [documents, revisions] = await Promise.all([
      listCmsDocuments(),
      listCmsRevisions(data?.documentId, 200),
    ]);
    return { documents, revisions };
  });

export const restoreCmsRevisionFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) => z.object({ revisionId: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "content.edit");
    const [
      { actorLabel, writeAudit },
      { getCmsDocumentById, getCmsRevisionById, upsertCmsDocument },
    ] = await Promise.all([import("./audit.server"), import("./platform-db.server")]);

    const rev = await getCmsRevisionById(data.revisionId);
    if (!rev) return { ok: false as const, error: "Revision not found." };
    const doc = await getCmsDocumentById(rev.document_id);
    if (!doc) return { ok: false as const, error: "Parent document no longer exists." };

    const snap = rev.snapshot as {
      title?: string;
      summary?: string;
      category?: string;
      slug?: string;
      payload?: Record<string, JsonValue | undefined>;
      seo?: Record<string, string>;
    };
    const label = (await actorLabel(context.userId)) ?? "admin";
    const restored = await upsertCmsDocument({
      id: doc.id,
      doc_type: doc.doc_type,
      slug: snap.slug ?? doc.slug,
      title: snap.title ?? doc.title,
      summary: snap.summary ?? doc.summary,
      category: snap.category ?? doc.category,
      status: "draft",
      sort_order: doc.sort_order,
      payload: snap.payload ?? doc.payload,
      seo: snap.seo ?? doc.seo,
      editor_id: context.userId,
      editor_label: label,
      change_summary: `Restored from version v${rev.version} (saved as draft for review)`,
      action: "restored",
    });

    await writeAudit({
      category: "activity",
      action: "cms.restored",
      actorId: context.userId,
      actorLabel: label,
      entityType: doc.doc_type,
      entityId: doc.id,
      subject: doc.title,
      metadata: { restoredVersion: rev.version },
    });

    return { ok: true as const, document: restored };
  });

// ============================================================================
// Media Library
// ============================================================================

export const getMediaLibraryFn = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    assertPermission(context.roles, "media.manage");
    const [{ listStoredMediaAssets }, { fetchGithubMediaAssets, fetchSanitySummaryAndAssets }] =
      await Promise.all([import("./platform-db.server"), import("./platform-services.server")]);

    const [sanity, github, stored] = await Promise.all([
      fetchSanitySummaryAndAssets(),
      fetchGithubMediaAssets(),
      listStoredMediaAssets(),
    ]);

    const d1Only = stored.filter((m) => m.source === "d1");
    return {
      assets: [...d1Only, ...sanity.assets, ...github.assets],
      sanityStatus: {
        reachable: sanity.reachable,
        hasWriteToken: sanity.hasWriteToken,
        error: sanity.error,
      },
      githubError: github.error,
    };
  });

export const uploadMediaAssetFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        filename: z.string().trim().min(1).max(160),
        mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]),
        base64Data: z.string().min(8).max(4_500_000),
        altText: z.string().max(300).default(""),
        caption: z.string().max(400).default(""),
        folder: z.string().max(80).default("uploads"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "media.manage");
    const [{ actorLabel, writeAudit }, { uploadImageAsset }] = await Promise.all([
      import("./audit.server"),
      import("./platform-services.server"),
    ]);
    const label = (await actorLabel(context.userId)) ?? "admin";
    const result = await uploadImageAsset({ ...data, uploadedBy: label });
    await writeAudit({
      category: "activity",
      action: "media.uploaded",
      actorId: context.userId,
      actorLabel: label,
      entityType: "media",
      entityId: result.asset.asset_key,
      subject: result.asset.filename,
      metadata: { storedIn: result.storedIn },
    });
    return { ok: true as const, ...result };
  });

export const updateMediaMetaFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        assetKey: z.string().min(1),
        source: z.enum(["sanity", "github", "d1"]),
        url: z.string().min(1),
        filename: z.string().min(1),
        altText: z.string().max(300),
        caption: z.string().max(400),
        folder: z.string().max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "media.manage");
    const [{ actorLabel, writeAudit }, { upsertMediaAsset }] = await Promise.all([
      import("./audit.server"),
      import("./platform-db.server"),
    ]);
    const label = (await actorLabel(context.userId)) ?? "admin";
    const asset = await upsertMediaAsset({
      source: data.source,
      asset_key: data.assetKey,
      url: data.url,
      filename: data.filename,
      alt_text: data.altText,
      caption: data.caption,
      folder: data.folder,
      uploaded_by: label,
    });
    await writeAudit({
      category: "activity",
      action: "media.updated",
      actorId: context.userId,
      actorLabel: label,
      entityType: "media",
      entityId: data.assetKey,
      subject: data.filename,
    });
    return { ok: true as const, asset };
  });

export const deleteMediaAssetFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) => z.object({ assetKey: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "media.manage");
    const [{ actorLabel, writeAudit }, { safeDeleteMediaAsset }] = await Promise.all([
      import("./audit.server"),
      import("./platform-services.server"),
    ]);
    const res = await safeDeleteMediaAsset(data.assetKey);
    if (!res.ok) return res;
    await writeAudit({
      category: "activity",
      action: "media.deleted",
      actorId: context.userId,
      actorLabel: await actorLabel(context.userId),
      entityType: "media",
      entityId: data.assetKey,
    });
    return { ok: true as const };
  });

// ============================================================================
// Enquiries
// ============================================================================

export const getEnquiriesFn = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ status: z.enum(["all", "new", "in_review", "replied", "archived"]).default("all") })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "content.edit");
    const [{ listEnquiries }, { listProfiles }] = await Promise.all([
      import("./platform-db.server"),
      import("./db.server"),
    ]);
    const [items, admins] = await Promise.all([
      listEnquiries(data.status === "all" ? undefined : { status: data.status }),
      listProfiles(),
    ]);
    return {
      items,
      admins: admins.map((a) => ({
        id: a.id,
        name: a.full_name || a.username,
        username: a.username,
      })),
    };
  });

export const createManualEnquiryFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(120),
        business: z.string().max(160).default(""),
        email: z.string().trim().email().max(254),
        phone: z.string().max(40).default(""),
        service: z.string().max(120).default(""),
        subject: z.string().max(160).default(""),
        message: z.string().trim().min(5).max(4000),
        category: z.string().max(60).default("general"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "content.edit");
    const [{ actorLabel, writeAudit }, { createEnquiry }] = await Promise.all([
      import("./audit.server"),
      import("./platform-db.server"),
    ]);
    const item = await createEnquiry({ ...data, source_page: "admin-manual" });
    await writeAudit({
      category: "activity",
      action: "enquiry.received",
      actorId: context.userId,
      actorLabel: await actorLabel(context.userId),
      entityType: "enquiry",
      entityId: item.id,
      subject: item.email,
    });
    return { ok: true as const, item };
  });

export const updateEnquiryFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().min(1),
        status: z.enum(["new", "in_review", "replied", "archived"]).optional(),
        is_read: z.boolean().optional(),
        assigned_to: z.string().nullable().optional(),
        category: z.string().max(60).optional(),
        internal_notes: z.string().max(4000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "content.edit");
    const [{ actorLabel, writeAudit }, { updateEnquiry }] = await Promise.all([
      import("./audit.server"),
      import("./platform-db.server"),
    ]);
    const { id, ...patch } = data;
    await updateEnquiry(id, patch);
    await writeAudit({
      category: "activity",
      action: "enquiry.updated",
      actorId: context.userId,
      actorLabel: await actorLabel(context.userId),
      entityType: "enquiry",
      entityId: id,
      metadata: { status: data.status, is_read: data.is_read, category: data.category },
    });
    return { ok: true as const };
  });

// ============================================================================
// SEO Centre
// ============================================================================

export const getSeoCentreFn = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    assertPermission(context.roles, "seo.view");
    const [
      { listCmsDocuments, listLatestSeoAudits, listSeoIssues },
      { generateRobotsTxt, generateSitemapXml },
    ] = await Promise.all([import("./platform-db.server"), import("./seo-analyzer")]);

    const [audits, issues, docs] = await Promise.all([
      listLatestSeoAudits(),
      listSeoIssues(),
      listCmsDocuments({ status: "published" }),
    ]);

    const origin = LIVE_SITE_URL.replace(/\/+$/, "");
    const sitemapEntries = docs
      .filter((d) => ["page", "service", "solution", "article", "portfolio"].includes(d.doc_type))
      .map((d) => ({
        path:
          d.doc_type === "page"
            ? d.slug
            : d.doc_type === "service"
              ? `/services/${d.slug}/`
              : d.doc_type === "solution"
                ? `/solutions/${d.slug}/`
                : d.doc_type === "article"
                  ? `/articles/${d.slug}/`
                  : `/our-work/${d.slug}/`,
        lastmod: d.updated_at,
        priority: d.slug === "/" ? "1.0" : d.doc_type === "page" ? "0.8" : "0.7",
      }));

    return {
      audits,
      issues,
      cmsPages: docs.filter(
        (d) =>
          d.doc_type === "page" ||
          d.doc_type === "service" ||
          d.doc_type === "solution" ||
          d.doc_type === "article",
      ),
      generatedSitemapXml: generateSitemapXml(origin, sitemapEntries),
      generatedRobotsTxt: generateRobotsTxt(origin),
    };
  });

export const runSeoCrawlFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    assertPermission(context.roles, "seo.view");
    const [{ actorLabel, writeAudit }, { runLiveSiteSeoCrawl }] = await Promise.all([
      import("./audit.server"),
      import("./platform-services.server"),
    ]);
    const result = await runLiveSiteSeoCrawl();
    await writeAudit({
      category: "activity",
      action: "seo.crawled",
      actorId: context.userId,
      actorLabel: await actorLabel(context.userId),
      entityType: "seo",
      metadata: {
        pagesCrawled: result.audits.length,
        issuesDetected: result.issues.length,
        sitemapStatus: result.sitemapStatus,
      },
    });
    return result;
  });

export const updateSeoIssueStatusFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().min(1), status: z.enum(["open", "resolved", "ignored"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "seo.manage");
    const [{ actorLabel, writeAudit }, { updateSeoIssueStatus }] = await Promise.all([
      import("./audit.server"),
      import("./platform-db.server"),
    ]);
    const label = (await actorLabel(context.userId)) ?? "admin";
    await updateSeoIssueStatus(data.id, data.status, label);
    await writeAudit({
      category: "activity",
      action: "seo.issue_updated",
      actorId: context.userId,
      actorLabel: label,
      entityType: "seo_issue",
      entityId: data.id,
      metadata: { status: data.status },
    });
    return { ok: true as const };
  });

// ============================================================================
// Analytics (GA4)
// ============================================================================

export const getGa4AnalyticsFn = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ days: z.union([z.literal(7), z.literal(28), z.literal(90)]).default(28) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "analytics.view");
    const { fetchGa4Analytics } = await import("./platform-services.server");
    return fetchGa4Analytics(data.days);
  });

// ============================================================================
// Performance (PageSpeed Insights)
// ============================================================================

export const getPerformanceFn = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    assertPermission(context.roles, "performance.view");
    const { getLatestPerformanceSnapshot } = await import("./platform-services.server");
    return getLatestPerformanceSnapshot();
  });

export const runPageSpeedFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        url: z.string().url().max(300).default(LIVE_SITE_URL),
        strategy: z.enum(["mobile", "desktop"]).default("mobile"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "performance.run");
    const [{ actorLabel, writeAudit }, { runRealPageSpeed }] = await Promise.all([
      import("./audit.server"),
      import("./platform-services.server"),
    ]);
    const report = await runRealPageSpeed(data.url, data.strategy);
    await writeAudit({
      category: "activity",
      action: "performance.tested",
      result: report.error ? "failure" : "success",
      actorId: context.userId,
      actorLabel: await actorLabel(context.userId),
      entityType: "pagespeed",
      entityId: report.id,
      subject: `${data.strategy} · ${data.url}`,
      metadata: {
        performance: report.performance_score,
        seo: report.seo_score,
        error: report.error ?? undefined,
      },
    });
    return report;
  });

// ============================================================================
// AI Intelligence & Tasks
// ============================================================================

export const getAiWorkspaceFn = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    assertPermission(context.roles, "ai.view");
    const [
      {
        listAiReports,
        listAiTasks,
        listEnquiries,
        listLatestSeoAudits,
        listPageSpeedReports,
        listSeoIssues,
      },
      { getRuntimeSecret },
    ] = await Promise.all([import("./platform-db.server"), import("./runtime-env.server")]);

    const [reports, tasks, audits, issues, speed, enquiries] = await Promise.all([
      listAiReports(25),
      listAiTasks(),
      listLatestSeoAudits(),
      listSeoIssues(),
      listPageSpeedReports(5),
      listEnquiries(),
    ]);

    return {
      hasAiProvider: Boolean(
        getRuntimeSecret("GEMINI_API_KEY") || getRuntimeSecret("OPENAI_API_KEY"),
      ),
      reports,
      tasks,
      signals: {
        pagesCrawled: audits.length,
        openSeoErrors: issues.filter((i) => i.status === "open" && i.severity === "error").length,
        openSeoWarnings: issues.filter((i) => i.status === "open" && i.severity === "warning")
          .length,
        latestSpeed: speed.find((s) => !s.error) ?? null,
        pendingEnquiries: enquiries.filter((e) => e.status === "new").length,
      },
    };
  });

export const generateAiReportFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        reportType: z.enum(["daily", "health", "seo", "content"]),
        topic: z.string().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "ai.use");
    const [
      { actorLabel, writeAudit },
      {
        getPlatformSettings,
        listEnquiries,
        listLatestSeoAudits,
        listPageSpeedReports,
        listSeoIssues,
        saveAiReport,
      },
      { generateGroundedAiAnalysis },
    ] = await Promise.all([
      import("./audit.server"),
      import("./platform-db.server"),
      import("./platform-services.server"),
    ]);

    const [settings, audits, issues, speed, enquiries] = await Promise.all([
      getPlatformSettings(),
      listLatestSeoAudits(),
      listSeoIssues(),
      listPageSpeedReports(6),
      listEnquiries(),
    ]);

    const openErrors = issues.filter((i) => i.status === "open" && i.severity === "error");
    const openWarnings = issues.filter((i) => i.status === "open" && i.severity === "warning");
    const latestMobile = speed.find((s) => s.strategy === "mobile" && !s.error) ?? null;
    let siteOnline = audits.some((a) => a.status_code === 200);
    if (!audits.length) {
      try {
        const probe = await fetch(settings.liveSiteUrl, { method: "HEAD" });
        siteOnline = probe.status >= 200 && probe.status < 400;
      } catch {
        siteOnline = false;
      }
    }

    const contextSignals = {
      siteUrl: settings.liveSiteUrl,
      siteOnline,
      pagesCrawled: audits.length,
      openSeoErrors: openErrors.length,
      openSeoWarnings: openWarnings.length,
      topSeoIssues: openErrors
        .concat(openWarnings)
        .slice(0, 6)
        .map((i) => `${i.page_path}: ${i.title}`),
      latestMobilePerformance: latestMobile?.performance_score ?? null,
      latestMobileSeo: latestMobile?.seo_score ?? null,
      pendingEnquiries: enquiries.filter((e) => e.status === "new").length,
    };

    const promptMap: Record<typeof data.reportType, string> = {
      daily:
        "Produce a concise daily executive website & growth diagnostic strictly from these telemetry signals.",
      health:
        "Evaluate technical website health across HTTP availability, SEO crawl findings, and Core Web Vitals.",
      seo: "Review the live crawl issues and recommend prioritized SEO metadata and schema fixes for administrator approval.",
      content: `Propose 3 practical bilingual-friendly article or landing content improvements for RYZITE. Topic focus: ${data.topic || "SEO & client lead generation"}.`,
    };

    const synthesis = await generateGroundedAiAnalysis({
      prompt: promptMap[data.reportType],
      contextSignals,
      preferredProvider: settings.preferredAiProvider,
    });

    const recommendations = openErrors
      .concat(openWarnings)
      .slice(0, 5)
      .map((i) => ({
        title: i.title,
        detail: i.suggested_fix,
        priority: (i.severity === "error" ? "high" : "medium") as "high" | "medium" | "low",
        targetUrl: i.page_path,
        category: "seo",
      }));

    const label = (await actorLabel(context.userId)) ?? "admin";
    const titlePrefix: Record<typeof data.reportType, string> = {
      daily: "Daily Website Intelligence Report",
      health: "Website Health Analysis",
      seo: "SEO Recommendations Brief",
      content: data.topic ? `Content Brief: ${data.topic}` : "AI Content Suggestions",
    };

    const report = await saveAiReport({
      report_type: data.reportType,
      title: titlePrefix[data.reportType],
      summary: synthesis.text,
      provider: synthesis.provider,
      grounded_signals: contextSignals,
      recommendations,
      created_by: label,
    });

    await writeAudit({
      category: "activity",
      action: "ai.report_generated",
      actorId: context.userId,
      actorLabel: label,
      entityType: "ai_report",
      entityId: report.id,
      subject: report.title,
      metadata: { usedRealAi: synthesis.usedRealAi, provider: synthesis.provider },
    });

    return {
      ok: true as const,
      report,
      ...(synthesis.warning ? { warning: synthesis.warning } : {}),
    };
  });

export const askAiAssistantFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z.object({ question: z.string().trim().min(3).max(800) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "ai.use");
    const [
      {
        getPlatformSettings,
        listEnquiries,
        listLatestSeoAudits,
        listPageSpeedReports,
        listSeoIssues,
      },
      { generateGroundedAiAnalysis },
    ] = await Promise.all([import("./platform-db.server"), import("./platform-services.server")]);

    const [settings, audits, issues, speed, enquiries] = await Promise.all([
      getPlatformSettings(),
      listLatestSeoAudits(),
      listSeoIssues(),
      listPageSpeedReports(4),
      listEnquiries(),
    ]);

    const latestMobile = speed.find((s) => s.strategy === "mobile" && !s.error) ?? null;
    let siteOnline = audits.some((a) => a.status_code === 200);
    if (!audits.length) {
      try {
        const probe = await fetch(settings.liveSiteUrl, { method: "HEAD" });
        siteOnline = probe.status >= 200 && probe.status < 400;
      } catch {
        siteOnline = false;
      }
    }
    return generateGroundedAiAnalysis({
      prompt: data.question,
      contextSignals: {
        siteUrl: settings.liveSiteUrl,
        siteOnline,
        pagesCrawled: audits.length,
        openSeoErrors: issues.filter((i) => i.status === "open" && i.severity === "error").length,
        openSeoWarnings: issues.filter((i) => i.status === "open" && i.severity === "warning")
          .length,
        latestMobilePerformance: latestMobile?.performance_score ?? null,
        pendingEnquiries: enquiries.filter((e) => e.status === "new").length,
        topIssues: issues
          .filter((i) => i.status === "open")
          .slice(0, 8)
          .map((i) => `${i.page_path}: ${i.title}`),
      },
      preferredProvider: settings.preferredAiProvider,
    });
  });

export const createAiTaskFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(3).max(200),
        description: z.string().max(1500).default(""),
        priority: z.enum(["high", "medium", "low"]).default("medium"),
        source: z.enum(["seo", "performance", "ai", "system"]).default("ai"),
        related_url: z.string().max(300).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "ai.use");
    const [{ actorLabel, writeAudit }, { createAiTask }] = await Promise.all([
      import("./audit.server"),
      import("./platform-db.server"),
    ]);
    const label = (await actorLabel(context.userId)) ?? "admin";
    const task = await createAiTask({ ...data, created_by: label });
    await writeAudit({
      category: "activity",
      action: "ai.task_updated",
      actorId: context.userId,
      actorLabel: label,
      entityType: "ai_task",
      entityId: task.id,
      subject: task.title,
    });
    return { ok: true as const, task };
  });

export const updateAiTaskFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().min(1),
        status: z.enum(["open", "in_progress", "done", "dismissed"]).optional(),
        priority: z.enum(["high", "medium", "low"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "ai.use");
    const [{ actorLabel, writeAudit }, { updateAiTask }] = await Promise.all([
      import("./audit.server"),
      import("./platform-db.server"),
    ]);
    const { id, ...patch } = data;
    await updateAiTask(id, patch);
    await writeAudit({
      category: "activity",
      action: "ai.task_updated",
      actorId: context.userId,
      actorLabel: await actorLabel(context.userId),
      entityType: "ai_task",
      entityId: id,
      metadata: patch,
    });
    return { ok: true as const };
  });

export const deleteAiTaskFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "ai.use");
    const { deleteAiTask } = await import("./platform-db.server");
    await deleteAiTask(data.id);
    return { ok: true as const };
  });

// ============================================================================
// System Deployments & Settings
// ============================================================================

export const getDeploymentsHealthFn = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    assertPermission(context.roles, "deployments.view");
    const { fetchDeploymentAndRepoHealth } = await import("./platform-services.server");
    return fetchDeploymentAndRepoHealth();
  });

export const getSystemSettingsFn = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    assertPermission(context.roles, "settings.manage");
    const [{ getPlatformSettings }, { getRuntimeSecret }] = await Promise.all([
      import("./platform-db.server"),
      import("./runtime-env.server"),
    ]);
    const settings = await getPlatformSettings();
    const secretPresence = {
      SESSION_SECRET: Boolean(getRuntimeSecret("SESSION_SECRET")),
      SANITY_API_TOKEN: Boolean(getRuntimeSecret("SANITY_API_TOKEN")),
      GA4_PROPERTY_ID: Boolean(getRuntimeSecret("GA4_PROPERTY_ID")),
      GA4_CLIENT_EMAIL: Boolean(getRuntimeSecret("GA4_CLIENT_EMAIL")),
      GA4_PRIVATE_KEY: Boolean(getRuntimeSecret("GA4_PRIVATE_KEY")),
      PAGESPEED_API_KEY: Boolean(getRuntimeSecret("PAGESPEED_API_KEY")),
      GEMINI_API_KEY: Boolean(getRuntimeSecret("GEMINI_API_KEY")),
      OPENAI_API_KEY: Boolean(getRuntimeSecret("OPENAI_API_KEY")),
      RESEND_API_KEY: Boolean(getRuntimeSecret("RESEND_API_KEY")),
      CLOUDFLARE_API_TOKEN: Boolean(getRuntimeSecret("CLOUDFLARE_API_TOKEN")),
      CLOUDFLARE_ACCOUNT_ID: Boolean(getRuntimeSecret("CLOUDFLARE_ACCOUNT_ID")),
      ENQUIRY_WEBHOOK_SECRET: Boolean(getRuntimeSecret("ENQUIRY_WEBHOOK_SECRET")),
    };
    return { settings, secretPresence };
  });

export const saveSystemSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        liveSiteUrl: z.string().url().max(240),
        defaultSeoTitleSuffix: z.string().max(80),
        defaultOgImage: z.string().max(400),
        defaultRobotsDirective: z.string().max(80),
        ga4MeasurementTagExpected: z.string().max(40),
        preferredAiProvider: z.enum(["auto", "gemini", "openai"]),
        pagespeedStrategyDefault: z.enum(["mobile", "desktop"]),
        sessionMaxAgeHours: z.number().int().min(1).max(168),
        enquiryNotificationEmail: z.string().email().max(254),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "settings.manage");
    const [{ actorLabel, writeAudit }, { savePlatformSettings }] = await Promise.all([
      import("./audit.server"),
      import("./platform-db.server"),
    ]);
    const label = (await actorLabel(context.userId)) ?? "admin";
    const updated = await savePlatformSettings(data, label);
    await writeAudit({
      category: "security",
      action: "settings.updated",
      actorId: context.userId,
      actorLabel: label,
      entityType: "settings",
      metadata: {
        preferredAiProvider: data.preferredAiProvider,
        sessionMaxAgeHours: data.sessionMaxAgeHours,
      },
    });
    return { ok: true as const, settings: updated };
  });
