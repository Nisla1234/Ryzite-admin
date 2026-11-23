import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  bannedUntil: text("banned_until"),
  createdAt: text("created_at").notNull(),
});

export const profiles = sqliteTable("profiles", {
  id: text("id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  username: text("username").notNull().unique(),
  fullName: text("full_name").notNull().default(""),
  email: text("email").notNull().default(""),
  jobTitle: text("job_title").notNull().default(""),
  avatarUrl: text("avatar_url"),
  lastSignInAt: text("last_sign_in_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const userRoles = sqliteTable(
  "user_roles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<"super_admin" | "admin" | "editor" | "analyst">().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_user_roles_user_id").on(table.userId)],
);

export const accessRequests = sqliteTable(
  "access_requests",
  {
    id: text("id").primaryKey(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    reason: text("reason").notNull(),
    status: text("status")
      .$type<"pending" | "approved" | "rejected">()
      .notNull()
      .default("pending"),
    assignedRole: text("assigned_role").$type<"super_admin" | "admin" | "editor" | "analyst">(),
    decidedBy: text("decided_by"),
    decidedAt: text("decided_at"),
    decisionNote: text("decision_note"),
    requesterIp: text("requester_ip"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_access_requests_status").on(table.status)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    category: text("category").$type<"activity" | "security">().notNull(),
    action: text("action").notNull(),
    result: text("result").$type<"success" | "failure" | "blocked">().notNull().default("success"),
    actorId: text("actor_id"),
    actorLabel: text("actor_label"),
    subject: text("subject"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: text("metadata").notNull().default("{}"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_audit_logs_category_created").on(table.category, table.createdAt),
    index("idx_audit_logs_action_created").on(table.action, table.createdAt),
  ],
);

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_password_reset_user_id").on(table.userId)],
);

export const avatars = sqliteTable("avatars", {
  path: text("path").primaryKey(),
  dataUrl: text("data_url").notNull(),
  createdAt: text("created_at").notNull(),
});

export const cmsDocuments = sqliteTable(
  "cms_documents",
  {
    id: text("id").primaryKey(),
    sanityId: text("sanity_id"),
    docType: text("doc_type")
      .$type<
        | "page"
        | "portfolio"
        | "service"
        | "solution"
        | "team"
        | "article"
        | "testimonial"
        | "navigation"
        | "seo_override"
      >()
      .notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    category: text("category").notNull().default(""),
    status: text("status")
      .$type<"draft" | "scheduled" | "published" | "archived">()
      .notNull()
      .default("published"),
    sortOrder: integer("sort_order").notNull().default(0),
    payloadJson: text("payload_json").notNull().default("{}"),
    seoJson: text("seo_json").notNull().default("{}"),
    scheduledAt: text("scheduled_at"),
    publishedAt: text("published_at"),
    sanitySyncedAt: text("sanity_synced_at"),
    updatedBy: text("updated_by"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_cms_documents_type_slug").on(table.docType, table.slug),
    index("idx_cms_documents_status").on(table.status),
  ],
);

export const cmsRevisions = sqliteTable(
  "cms_revisions",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => cmsDocuments.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    changeSummary: text("change_summary").notNull().default(""),
    action: text("action")
      .$type<"draft_saved" | "published" | "unpublished" | "archived" | "restored" | "imported">()
      .notNull(),
    editorId: text("editor_id"),
    editorLabel: text("editor_label"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_cms_revisions_doc_created").on(table.documentId, table.createdAt)],
);

export const mediaAssets = sqliteTable(
  "media_assets",
  {
    id: text("id").primaryKey(),
    source: text("source").$type<"sanity" | "github" | "d1">().notNull(),
    assetKey: text("asset_key").notNull().unique(),
    url: text("url").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull().default("image/webp"),
    width: integer("width"),
    height: integer("height"),
    sizeBytes: integer("size_bytes"),
    altText: text("alt_text").notNull().default(""),
    caption: text("caption").notNull().default(""),
    folder: text("folder").notNull().default("general"),
    dataUrl: text("data_url"),
    uploadedBy: text("uploaded_by"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_media_assets_source").on(table.source)],
);

export const websiteEnquiries = sqliteTable(
  "website_enquiries",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    business: text("business").notNull().default(""),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    service: text("service").notNull().default(""),
    subject: text("subject").notNull().default(""),
    message: text("message").notNull(),
    sourcePage: text("source_page").notNull().default("/contact"),
    status: text("status")
      .$type<"new" | "in_review" | "replied" | "archived">()
      .notNull()
      .default("new"),
    isRead: integer("is_read").notNull().default(0),
    assignedTo: text("assigned_to"),
    category: text("category").notNull().default("general"),
    internalNotes: text("internal_notes").notNull().default(""),
    requesterIp: text("requester_ip"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_website_enquiries_status_created").on(table.status, table.createdAt),
    index("idx_website_enquiries_read").on(table.isRead),
  ],
);

export const seoAudits = sqliteTable(
  "seo_audits",
  {
    id: text("id").primaryKey(),
    url: text("url").notNull(),
    pagePath: text("page_path").notNull(),
    statusCode: integer("status_code").notNull(),
    title: text("title").notNull().default(""),
    metaDescription: text("meta_description").notNull().default(""),
    canonicalUrl: text("canonical_url").notNull().default(""),
    robotsMeta: text("robots_meta").notNull().default(""),
    ogTitle: text("og_title").notNull().default(""),
    ogDescription: text("og_description").notNull().default(""),
    ogImage: text("og_image").notNull().default(""),
    h1Count: integer("h1_count").notNull().default(0),
    h1Text: text("h1_text").notNull().default(""),
    hasJsonLd: integer("has_json_ld").notNull().default(0),
    jsonLdTypesJson: text("json_ld_types_json").notNull().default("[]"),
    hasGa4Tag: integer("has_ga4_tag").notNull().default(0),
    ga4MeasurementId: text("ga4_measurement_id"),
    brokenLinksJson: text("broken_links_json").notNull().default("[]"),
    issuesJson: text("issues_json").notNull().default("[]"),
    responseMs: integer("response_ms").notNull().default(0),
    checkedAt: text("checked_at").notNull(),
  },
  (table) => [index("idx_seo_audits_path_checked").on(table.pagePath, table.checkedAt)],
);

export const seoIssues = sqliteTable(
  "seo_issues",
  {
    id: text("id").primaryKey(),
    pagePath: text("page_path").notNull(),
    url: text("url").notNull(),
    severity: text("severity").$type<"error" | "warning" | "info">().notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    explanation: text("explanation").notNull(),
    suggestedFix: text("suggested_fix").notNull(),
    status: text("status").$type<"open" | "resolved" | "ignored">().notNull().default("open"),
    resolvedBy: text("resolved_by"),
    resolvedAt: text("resolved_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_seo_issues_status_severity").on(table.status, table.severity)],
);

export const pagespeedReports = sqliteTable(
  "pagespeed_reports",
  {
    id: text("id").primaryKey(),
    url: text("url").notNull(),
    strategy: text("strategy").$type<"mobile" | "desktop">().notNull(),
    performanceScore: integer("performance_score"),
    accessibilityScore: integer("accessibility_score"),
    bestPracticesScore: integer("best_practices_score"),
    seoScore: integer("seo_score"),
    lcpMs: real("lcp_ms"),
    inpMs: real("inp_ms"),
    clsScore: real("cls_score"),
    fcpMs: real("fcp_ms"),
    ttfbMs: real("ttfb_ms"),
    fieldLcpMs: real("field_lcp_ms"),
    fieldInpMs: real("field_inp_ms"),
    fieldCls: real("field_cls"),
    opportunitiesJson: text("opportunities_json").notNull().default("[]"),
    auditsJson: text("audits_json").notNull().default("[]"),
    error: text("error"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_pagespeed_url_created").on(table.url, table.createdAt)],
);

export const aiReports = sqliteTable(
  "ai_reports",
  {
    id: text("id").primaryKey(),
    reportType: text("report_type").$type<"daily" | "health" | "seo" | "content">().notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    provider: text("provider").notNull(),
    groundedSignalsJson: text("grounded_signals_json").notNull().default("{}"),
    recommendationsJson: text("recommendations_json").notNull().default("[]"),
    createdBy: text("created_by"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_ai_reports_type_created").on(table.reportType, table.createdAt)],
);

export const aiTasks = sqliteTable(
  "ai_tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    priority: text("priority").$type<"high" | "medium" | "low">().notNull().default("medium"),
    source: text("source").$type<"seo" | "performance" | "ai" | "system">().notNull().default("ai"),
    relatedUrl: text("related_url").notNull().default(""),
    status: text("status")
      .$type<"open" | "in_progress" | "done" | "dismissed">()
      .notNull()
      .default("open"),
    assignedTo: text("assigned_to"),
    createdBy: text("created_by"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_ai_tasks_status_priority").on(table.status, table.priority)],
);

export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at").notNull(),
});
