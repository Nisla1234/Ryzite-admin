// Role → permission matrix for the Control Centre.
// UI uses this to hide controls; the database (RLS) and server functions enforce it.
export const ROLES = ["super_admin", "admin", "editor", "analyst"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  editor: "Editor",
  analyst: "Analyst",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: "Full access, user approval, publishing, integrations and security settings.",
  admin: "Website management, SEO, analytics and performance monitoring.",
  editor: "Content editing, media and drafts. Cannot publish or change system settings.",
  analyst: "Read-only analytics, SEO reports and performance reports.",
};

export type Permission =
  | "dashboard.view"
  | "content.edit"
  | "content.publish"
  | "media.manage"
  | "seo.view"
  | "seo.manage"
  | "analytics.view"
  | "performance.view"
  | "performance.run"
  | "ai.view"
  | "ai.use"
  | "users.manage"
  | "access.review"
  | "logs.activity"
  | "logs.security"
  | "integrations.manage"
  | "deployments.view"
  | "settings.manage"
  | "profile.manage";

const ALL: Permission[] = [
  "dashboard.view",
  "content.edit",
  "content.publish",
  "media.manage",
  "seo.view",
  "seo.manage",
  "analytics.view",
  "performance.view",
  "performance.run",
  "ai.view",
  "ai.use",
  "users.manage",
  "access.review",
  "logs.activity",
  "logs.security",
  "integrations.manage",
  "deployments.view",
  "settings.manage",
  "profile.manage",
];

const MATRIX: Record<Role, readonly Permission[]> = {
  super_admin: ALL,
  admin: [
    "dashboard.view",
    "content.edit",
    "content.publish",
    "media.manage",
    "seo.view",
    "seo.manage",
    "analytics.view",
    "performance.view",
    "performance.run",
    "ai.view",
    "ai.use",
    "logs.activity",
    "deployments.view",
    "profile.manage",
  ],
  editor: [
    "dashboard.view",
    "content.edit",
    "media.manage",
    "seo.view",
    "ai.view",
    "profile.manage",
  ],
  analyst: [
    "dashboard.view",
    "seo.view",
    "analytics.view",
    "performance.view",
    "ai.view",
    "profile.manage",
  ],
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function can(roles: readonly string[], permission: Permission): boolean {
  return roles.some((r) => isRole(r) && MATRIX[r].includes(permission));
}

export function primaryRole(roles: readonly string[]): Role | null {
  for (const r of ROLES) if (roles.includes(r)) return r;
  return null;
}
