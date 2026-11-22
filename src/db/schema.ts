import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
