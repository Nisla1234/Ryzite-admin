CREATE TABLE IF NOT EXISTS cms_documents (
  id TEXT PRIMARY KEY NOT NULL,
  sanity_id TEXT,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('page', 'portfolio', 'service', 'solution', 'team', 'article', 'testimonial', 'navigation', 'seo_override')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL DEFAULT '{}',
  seo_json TEXT NOT NULL DEFAULT '{}',
  scheduled_at TEXT,
  published_at TEXT,
  sanity_synced_at TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cms_documents_type_slug ON cms_documents(doc_type, slug);
CREATE INDEX IF NOT EXISTS idx_cms_documents_status ON cms_documents(status);

CREATE TABLE IF NOT EXISTS cms_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL REFERENCES cms_documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  change_summary TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL CHECK (action IN ('draft_saved', 'published', 'unpublished', 'archived', 'restored', 'imported')),
  editor_id TEXT,
  editor_label TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cms_revisions_doc_created ON cms_revisions(document_id, created_at);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('sanity', 'github', 'd1')),
  asset_key TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/webp',
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  alt_text TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  folder TEXT NOT NULL DEFAULT 'general',
  data_url TEXT,
  uploaded_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_assets_source ON media_assets(source);

CREATE TABLE IF NOT EXISTS website_enquiries (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  business TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  source_page TEXT NOT NULL DEFAULT '/contact',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'replied', 'archived')),
  is_read INTEGER NOT NULL DEFAULT 0,
  assigned_to TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  internal_notes TEXT NOT NULL DEFAULT '',
  requester_ip TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_website_enquiries_status_created ON website_enquiries(status, created_at);
CREATE INDEX IF NOT EXISTS idx_website_enquiries_read ON website_enquiries(is_read);

CREATE TABLE IF NOT EXISTS seo_audits (
  id TEXT PRIMARY KEY NOT NULL,
  url TEXT NOT NULL,
  page_path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  canonical_url TEXT NOT NULL DEFAULT '',
  robots_meta TEXT NOT NULL DEFAULT '',
  og_title TEXT NOT NULL DEFAULT '',
  og_description TEXT NOT NULL DEFAULT '',
  og_image TEXT NOT NULL DEFAULT '',
  h1_count INTEGER NOT NULL DEFAULT 0,
  h1_text TEXT NOT NULL DEFAULT '',
  has_json_ld INTEGER NOT NULL DEFAULT 0,
  json_ld_types_json TEXT NOT NULL DEFAULT '[]',
  has_ga4_tag INTEGER NOT NULL DEFAULT 0,
  ga4_measurement_id TEXT,
  broken_links_json TEXT NOT NULL DEFAULT '[]',
  issues_json TEXT NOT NULL DEFAULT '[]',
  response_ms INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seo_audits_path_checked ON seo_audits(page_path, checked_at);

CREATE TABLE IF NOT EXISTS seo_issues (
  id TEXT PRIMARY KEY NOT NULL,
  page_path TEXT NOT NULL,
  url TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('error', 'warning', 'info')),
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  explanation TEXT NOT NULL,
  suggested_fix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seo_issues_status_severity ON seo_issues(status, severity);

CREATE TABLE IF NOT EXISTS pagespeed_reports (
  id TEXT PRIMARY KEY NOT NULL,
  url TEXT NOT NULL,
  strategy TEXT NOT NULL CHECK (strategy IN ('mobile', 'desktop')),
  performance_score INTEGER,
  accessibility_score INTEGER,
  best_practices_score INTEGER,
  seo_score INTEGER,
  lcp_ms REAL,
  inp_ms REAL,
  cls_score REAL,
  fcp_ms REAL,
  ttfb_ms REAL,
  field_lcp_ms REAL,
  field_inp_ms REAL,
  field_cls REAL,
  opportunities_json TEXT NOT NULL DEFAULT '[]',
  audits_json TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pagespeed_url_created ON pagespeed_reports(url, created_at);

CREATE TABLE IF NOT EXISTS ai_reports (
  id TEXT PRIMARY KEY NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'health', 'seo', 'content')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  provider TEXT NOT NULL,
  grounded_signals_json TEXT NOT NULL DEFAULT '{}',
  recommendations_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_reports_type_created ON ai_reports(report_type, created_at);

CREATE TABLE IF NOT EXISTS ai_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  source TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('seo', 'performance', 'ai', 'system')),
  related_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'dismissed')),
  assigned_to TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_status_priority ON ai_tasks(status, priority);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL
);
