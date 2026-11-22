import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { Role } from "./permissions";
import { getD1Database } from "./runtime-env.server";
import type { AccessRequestRow, AdminProfile, AuditLogRow, JsonValue } from "./session";

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  banned_until: string | null;
  created_at: string;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

interface PasswordResetRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

interface LocalStore {
  users: UserRecord[];
  profiles: AdminProfile[];
  user_roles: UserRoleRow[];
  access_requests: AccessRequestRow[];
  audit_logs: AuditLogRow[];
  password_reset_tokens: PasswordResetRecord[];
  avatars: Record<string, string>;
}

const LOCAL_STORE_KEY = "__RYZITE_LOCAL_DB_STORE__";
const PRIMARY_ADMIN_PASSWORD_HASH =
  "scrypt:85741a762e932a8775248aa62e6b0b7e:d7e5dfd1be4c12ce5f456f813053edbc40fb2b611044028ef9e2af082d1a4b1d154a28cbe182f5dbeccad463472761625ea5d31fd900c653489d313cedf32928";
const SECONDARY_EDITOR_PASSWORD_HASH =
  "scrypt:9e4314c629bd7e03dd4eb86ae88f1761:45a14d0082ba7002736679cb641c310051791e56e9e2bdd67e604b53da5dbe3a8f7e25cb44b6be9e8bb11765690e1a7b1fe0da61f706736d3752c0920aa20df4";

function createInitialLocalStore(): LocalStore {
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  const adminId = "11111111-1111-4111-8111-111111111111";
  const editorId = "22222222-2222-4222-8222-222222222222";

  return {
    users: [
      {
        id: adminId,
        email: "ryziteonline@gmail.com",
        password_hash: PRIMARY_ADMIN_PASSWORD_HASH,
        banned_until: null,
        created_at: hoursAgo(240),
      },
      {
        id: editorId,
        email: "editor@ryzite.com",
        password_hash: SECONDARY_EDITOR_PASSWORD_HASH,
        banned_until: null,
        created_at: hoursAgo(120),
      },
    ],
    profiles: [
      {
        id: adminId,
        username: "ryzite_admin",
        full_name: "RYZITE Administrator",
        email: "ryziteonline@gmail.com",
        job_title: "Super Administrator",
        avatar_url: null,
        last_sign_in_at: hoursAgo(2),
        created_at: hoursAgo(240),
        updated_at: hoursAgo(2),
      },
      {
        id: editorId,
        username: "editor",
        full_name: "Priya Nair",
        email: "editor@ryzite.com",
        job_title: "Content Lead",
        avatar_url: null,
        last_sign_in_at: hoursAgo(18),
        created_at: hoursAgo(120),
        updated_at: hoursAgo(18),
      },
    ],
    user_roles: [
      {
        id: "aaaa1111-1111-4111-8111-111111111111",
        user_id: adminId,
        role: "super_admin",
        created_at: hoursAgo(240),
      },
      {
        id: "aaaa2222-2222-4222-8222-222222222222",
        user_id: editorId,
        role: "editor",
        created_at: hoursAgo(120),
      },
    ],
    access_requests: [
      {
        id: "bbbb1111-1111-4111-8111-111111111111",
        full_name: "Sara Chen",
        email: "sara.chen@ryzite.com",
        reason:
          "Managing SEO metadata and publishing quarterly case studies for the RYZITE website.",
        status: "pending",
        assigned_role: null,
        decided_by: null,
        decided_at: null,
        decision_note: null,
        requester_ip: "127.0.0.1",
        created_at: hoursAgo(6),
      },
    ],
    audit_logs: [
      {
        id: "cccc1111-1111-4111-8111-111111111111",
        category: "security",
        action: "auth.login",
        result: "success",
        actor_id: adminId,
        actor_label: "ryzite_admin",
        subject: "ryzite_admin",
        entity_type: null,
        entity_id: null,
        metadata: {},
        ip: "127.0.0.1",
        user_agent: "Mozilla/5.0",
        created_at: hoursAgo(2),
      },
      {
        id: "cccc2222-2222-4222-8222-222222222222",
        category: "activity",
        action: "integration.test",
        result: "success",
        actor_id: adminId,
        actor_label: "ryzite_admin",
        subject: null,
        entity_type: "integration",
        entity_id: "sanity",
        metadata: { state: "configuration_required" },
        ip: "127.0.0.1",
        user_agent: "Mozilla/5.0",
        created_at: hoursAgo(1),
      },
    ],
    password_reset_tokens: [],
    avatars: {},
  };
}

function getLocalStore(): LocalStore {
  const g = globalThis as Record<string, unknown>;
  if (!g[LOCAL_STORE_KEY]) {
    g[LOCAL_STORE_KEY] = createInitialLocalStore();
  }
  return g[LOCAL_STORE_KEY] as LocalStore;
}

export function isD1Configured(): boolean {
  return getD1Database() !== null;
}

function getD1Drizzle() {
  const d1 = getD1Database();
  return d1 ? drizzle(d1, { schema }) : null;
}

function parseMetadata(raw: string): Record<string, JsonValue | undefined> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, JsonValue | undefined>)
      : {};
  } catch {
    return {};
  }
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const db = getD1Drizzle();
  if (!db) return getLocalStore().users.find((u) => u.id === id) ?? null;
  const row = await db.select().from(schema.users).where(eq(schema.users.id, id)).get();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    password_hash: row.passwordHash,
    banned_until: row.bannedUntil ?? null,
    created_at: row.createdAt,
  };
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const normalized = email.trim().toLowerCase();
  const db = getD1Drizzle();
  if (!db) {
    return getLocalStore().users.find((u) => u.email.toLowerCase() === normalized) ?? null;
  }
  const row = await db.select().from(schema.users).where(eq(schema.users.email, normalized)).get();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    password_hash: row.passwordHash,
    banned_until: row.bannedUntil ?? null,
    created_at: row.createdAt,
  };
}

export async function createUserAccount(input: {
  email: string;
  passwordHash: string;
  username: string;
  fullName: string;
  role: Role;
}): Promise<{ id: string }> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedUsername = input.username.trim().toLowerCase();

  const db = getD1Drizzle();
  if (!db) {
    const store = getLocalStore();
    store.users.push({
      id,
      email: normalizedEmail,
      password_hash: input.passwordHash,
      banned_until: null,
      created_at: now,
    });
    store.profiles.push({
      id,
      username: normalizedUsername,
      full_name: input.fullName,
      email: normalizedEmail,
      job_title: "",
      avatar_url: null,
      last_sign_in_at: null,
      created_at: now,
      updated_at: now,
    });
    store.user_roles.push({
      id: randomUUID(),
      user_id: id,
      role: input.role,
      created_at: now,
    });
    return { id };
  }

  await db.insert(schema.users).values({
    id,
    email: normalizedEmail,
    passwordHash: input.passwordHash,
    bannedUntil: null,
    createdAt: now,
  });
  await db.insert(schema.profiles).values({
    id,
    username: normalizedUsername,
    fullName: input.fullName,
    email: normalizedEmail,
    jobTitle: "",
    avatarUrl: null,
    lastSignInAt: null,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.userRoles).values({
    id: randomUUID(),
    userId: id,
    role: input.role,
    createdAt: now,
  });
  return { id };
}

export async function updateUserPasswordHash(userId: string, passwordHash: string): Promise<void> {
  const db = getD1Drizzle();
  if (!db) {
    const user = getLocalStore().users.find((u) => u.id === userId);
    if (user) user.password_hash = passwordHash;
    return;
  }
  await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, userId));
}

export async function setUserBannedUntil(
  userId: string,
  bannedUntil: string | null,
): Promise<void> {
  const db = getD1Drizzle();
  if (!db) {
    const user = getLocalStore().users.find((u) => u.id === userId);
    if (user) user.banned_until = bannedUntil;
    return;
  }
  await db.update(schema.users).set({ bannedUntil }).where(eq(schema.users.id, userId));
}

export async function getProfileById(id: string): Promise<AdminProfile | null> {
  const db = getD1Drizzle();
  if (!db) return getLocalStore().profiles.find((p) => p.id === id) ?? null;
  const row = await db.select().from(schema.profiles).where(eq(schema.profiles.id, id)).get();
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    full_name: row.fullName,
    email: row.email,
    job_title: row.jobTitle,
    avatar_url: row.avatarUrl ?? null,
    last_sign_in_at: row.lastSignInAt ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function getProfileByUsername(username: string): Promise<AdminProfile | null> {
  const normalized = username.trim().toLowerCase();
  const db = getD1Drizzle();
  if (!db) {
    return getLocalStore().profiles.find((p) => p.username.toLowerCase() === normalized) ?? null;
  }
  const row = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.username, normalized))
    .get();
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    full_name: row.fullName,
    email: row.email,
    job_title: row.jobTitle,
    avatar_url: row.avatarUrl ?? null,
    last_sign_in_at: row.lastSignInAt ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function listProfiles(): Promise<AdminProfile[]> {
  const db = getD1Drizzle();
  if (!db) {
    return [...getLocalStore().profiles].sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  const rows = await db.select().from(schema.profiles).orderBy(schema.profiles.createdAt).all();
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    full_name: row.fullName,
    email: row.email,
    job_title: row.jobTitle,
    avatar_url: row.avatarUrl ?? null,
    last_sign_in_at: row.lastSignInAt ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }));
}

export async function countProfiles(): Promise<number> {
  const db = getD1Drizzle();
  if (!db) return getLocalStore().profiles.length;
  const row = await db.select({ value: count() }).from(schema.profiles).get();
  return row?.value ?? 0;
}

export async function updateProfile(
  id: string,
  patch: Partial<
    Pick<AdminProfile, "full_name" | "job_title" | "avatar_url" | "last_sign_in_at" | "email">
  >,
): Promise<void> {
  const updatedAt = new Date().toISOString();
  const db = getD1Drizzle();
  if (!db) {
    const profile = getLocalStore().profiles.find((p) => p.id === id);
    if (profile) {
      Object.assign(profile, patch, { updated_at: updatedAt });
    }
    return;
  }
  await db
    .update(schema.profiles)
    .set({
      ...(patch.full_name !== undefined ? { fullName: patch.full_name } : {}),
      ...(patch.job_title !== undefined ? { jobTitle: patch.job_title } : {}),
      ...(patch.avatar_url !== undefined ? { avatarUrl: patch.avatar_url } : {}),
      ...(patch.last_sign_in_at !== undefined ? { lastSignInAt: patch.last_sign_in_at } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      updatedAt,
    })
    .where(eq(schema.profiles.id, id));
}

export async function getUserRoles(userId: string): Promise<Role[]> {
  const db = getD1Drizzle();
  if (!db) {
    return getLocalStore()
      .user_roles.filter((r) => r.user_id === userId)
      .map((r) => r.role);
  }
  const rows = await db
    .select({ role: schema.userRoles.role })
    .from(schema.userRoles)
    .where(eq(schema.userRoles.userId, userId))
    .all();
  return rows.map((r) => r.role);
}

export async function listAllUserRoles(): Promise<UserRoleRow[]> {
  const db = getD1Drizzle();
  if (!db) return [...getLocalStore().user_roles];
  const rows = await db.select().from(schema.userRoles).all();
  return rows.map((r) => ({
    id: r.id,
    user_id: r.userId,
    role: r.role,
    created_at: r.createdAt,
  }));
}

export async function countSuperAdmins(): Promise<number> {
  const db = getD1Drizzle();
  if (!db) {
    return getLocalStore().user_roles.filter((r) => r.role === "super_admin").length;
  }
  const row = await db
    .select({ value: count() })
    .from(schema.userRoles)
    .where(eq(schema.userRoles.role, "super_admin"))
    .get();
  return row?.value ?? 0;
}

export async function replaceUserRole(userId: string, role: Role): Promise<void> {
  const now = new Date().toISOString();
  const db = getD1Drizzle();
  if (!db) {
    const store = getLocalStore();
    store.user_roles = store.user_roles.filter((r) => r.user_id !== userId);
    store.user_roles.push({ id: randomUUID(), user_id: userId, role, created_at: now });
    return;
  }
  await db.delete(schema.userRoles).where(eq(schema.userRoles.userId, userId));
  await db.insert(schema.userRoles).values({
    id: randomUUID(),
    userId,
    role,
    createdAt: now,
  });
}

export async function deleteUserRoles(userId: string): Promise<void> {
  const db = getD1Drizzle();
  if (!db) {
    const store = getLocalStore();
    store.user_roles = store.user_roles.filter((r) => r.user_id !== userId);
    return;
  }
  await db.delete(schema.userRoles).where(eq(schema.userRoles.userId, userId));
}

export async function listAccessRequests(
  status: "pending" | "approved" | "rejected",
): Promise<AccessRequestRow[]> {
  const db = getD1Drizzle();
  if (!db) {
    return getLocalStore()
      .access_requests.filter((r) => r.status === status)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const rows = await db
    .select()
    .from(schema.accessRequests)
    .where(eq(schema.accessRequests.status, status))
    .orderBy(desc(schema.accessRequests.createdAt))
    .all();
  return rows.map((r) => ({
    id: r.id,
    full_name: r.fullName,
    email: r.email,
    reason: r.reason,
    status: r.status,
    assigned_role: r.assignedRole ?? null,
    decided_by: r.decidedBy ?? null,
    decided_at: r.decidedAt ?? null,
    decision_note: r.decisionNote ?? null,
    requester_ip: r.requesterIp ?? null,
    created_at: r.createdAt,
  }));
}

export async function countPendingAccessRequests(): Promise<number> {
  const db = getD1Drizzle();
  if (!db) {
    return getLocalStore().access_requests.filter((r) => r.status === "pending").length;
  }
  const row = await db
    .select({ value: count() })
    .from(schema.accessRequests)
    .where(eq(schema.accessRequests.status, "pending"))
    .get();
  return row?.value ?? 0;
}

export async function getAccessRequestById(id: string): Promise<AccessRequestRow | null> {
  const db = getD1Drizzle();
  if (!db) return getLocalStore().access_requests.find((r) => r.id === id) ?? null;
  const r = await db
    .select()
    .from(schema.accessRequests)
    .where(eq(schema.accessRequests.id, id))
    .get();
  if (!r) return null;
  return {
    id: r.id,
    full_name: r.fullName,
    email: r.email,
    reason: r.reason,
    status: r.status,
    assigned_role: r.assignedRole ?? null,
    decided_by: r.decidedBy ?? null,
    decided_at: r.decidedAt ?? null,
    decision_note: r.decisionNote ?? null,
    requester_ip: r.requesterIp ?? null,
    created_at: r.createdAt,
  };
}

export async function findPendingAccessRequestByEmail(
  email: string,
): Promise<AccessRequestRow | null> {
  const normalized = email.trim().toLowerCase();
  const db = getD1Drizzle();
  if (!db) {
    return (
      getLocalStore().access_requests.find(
        (r) => r.email.toLowerCase() === normalized && r.status === "pending",
      ) ?? null
    );
  }
  const r = await db
    .select()
    .from(schema.accessRequests)
    .where(
      and(eq(schema.accessRequests.email, normalized), eq(schema.accessRequests.status, "pending")),
    )
    .get();
  if (!r) return null;
  return {
    id: r.id,
    full_name: r.fullName,
    email: r.email,
    reason: r.reason,
    status: r.status,
    assigned_role: r.assignedRole ?? null,
    decided_by: r.decidedBy ?? null,
    decided_at: r.decidedAt ?? null,
    decision_note: r.decisionNote ?? null,
    requester_ip: r.requesterIp ?? null,
    created_at: r.createdAt,
  };
}

export async function createAccessRequest(input: {
  full_name: string;
  email: string;
  reason: string;
  requester_ip: string | null;
}): Promise<{ id: string }> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const email = input.email.trim().toLowerCase();
  const db = getD1Drizzle();
  if (!db) {
    getLocalStore().access_requests.push({
      id,
      full_name: input.full_name,
      email,
      reason: input.reason,
      status: "pending",
      assigned_role: null,
      decided_by: null,
      decided_at: null,
      decision_note: null,
      requester_ip: input.requester_ip,
      created_at: now,
    });
    return { id };
  }
  await db.insert(schema.accessRequests).values({
    id,
    fullName: input.full_name,
    email,
    reason: input.reason,
    status: "pending",
    requesterIp: input.requester_ip,
    createdAt: now,
  });
  return { id };
}

export async function updateAccessRequestDecision(
  id: string,
  patch: {
    status: "approved" | "rejected";
    assigned_role?: Role | null;
    decided_by: string;
    decided_at: string;
    decision_note: string | null;
  },
): Promise<void> {
  const db = getD1Drizzle();
  if (!db) {
    const req = getLocalStore().access_requests.find((r) => r.id === id);
    if (req) Object.assign(req, patch);
    return;
  }
  await db
    .update(schema.accessRequests)
    .set({
      status: patch.status,
      ...(patch.assigned_role !== undefined ? { assignedRole: patch.assigned_role } : {}),
      decidedBy: patch.decided_by,
      decidedAt: patch.decided_at,
      decisionNote: patch.decision_note,
    })
    .where(eq(schema.accessRequests.id, id));
}

export async function insertAuditLog(entry: Omit<AuditLogRow, "id" | "created_at">): Promise<void> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const db = getD1Drizzle();
  if (!db) {
    getLocalStore().audit_logs.push({ id, created_at: now, ...entry });
    return;
  }
  await db.insert(schema.auditLogs).values({
    id,
    category: entry.category,
    action: entry.action,
    result: entry.result,
    actorId: entry.actor_id,
    actorLabel: entry.actor_label,
    subject: entry.subject,
    entityType: entry.entity_type,
    entityId: entry.entity_id,
    metadata: JSON.stringify(entry.metadata ?? {}),
    ip: entry.ip,
    userAgent: entry.user_agent,
    createdAt: now,
  });
}

export async function listAuditLogs(opts: {
  category?: "activity" | "security";
  action?: string;
  result?: "success" | "failure" | "blocked";
  limit?: number;
}): Promise<AuditLogRow[]> {
  const limit = opts.limit ?? 500;
  const db = getD1Drizzle();
  if (!db) {
    return getLocalStore()
      .audit_logs.filter(
        (row) =>
          (!opts.category || row.category === opts.category) &&
          (!opts.action || row.action === opts.action) &&
          (!opts.result || row.result === opts.result),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }

  const conditions = [];
  if (opts.category) conditions.push(eq(schema.auditLogs.category, opts.category));
  if (opts.action) conditions.push(eq(schema.auditLogs.action, opts.action));
  if (opts.result) conditions.push(eq(schema.auditLogs.result, opts.result));

  const query = db.select().from(schema.auditLogs);
  const filtered = conditions.length ? query.where(and(...conditions)) : query;
  const rows = await filtered.orderBy(desc(schema.auditLogs.createdAt)).limit(limit).all();

  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    action: r.action,
    result: r.result,
    actor_id: r.actorId ?? null,
    actor_label: r.actorLabel ?? null,
    subject: r.subject ?? null,
    entity_type: r.entityType ?? null,
    entity_id: r.entityId ?? null,
    metadata: parseMetadata(r.metadata),
    ip: r.ip ?? null,
    user_agent: r.userAgent ?? null,
    created_at: r.createdAt,
  }));
}

export async function countRecentAuditLogs(opts: {
  action: string;
  sinceIso: string;
  subject?: string;
  ip?: string | null;
}): Promise<number> {
  const db = getD1Drizzle();
  if (!db) {
    return getLocalStore().audit_logs.filter(
      (r) =>
        r.action === opts.action &&
        r.created_at >= opts.sinceIso &&
        (!opts.subject || r.subject === opts.subject) &&
        (!opts.ip || r.ip === opts.ip),
    ).length;
  }

  const conditions = [
    eq(schema.auditLogs.action, opts.action),
    gte(schema.auditLogs.createdAt, opts.sinceIso),
  ];
  if (opts.subject) conditions.push(eq(schema.auditLogs.subject, opts.subject));
  if (opts.ip) conditions.push(eq(schema.auditLogs.ip, opts.ip));

  const row = await db
    .select({ value: count() })
    .from(schema.auditLogs)
    .where(and(...conditions))
    .get();
  return row?.value ?? 0;
}

export async function createPasswordResetToken(input: {
  userId: string;
  tokenHash: string;
  expiresAt: string;
}): Promise<void> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const db = getD1Drizzle();
  if (!db) {
    getLocalStore().password_reset_tokens.push({
      id,
      user_id: input.userId,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt,
      used_at: null,
      created_at: now,
    });
    return;
  }
  await db.insert(schema.passwordResetTokens).values({
    id,
    userId: input.userId,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    usedAt: null,
    createdAt: now,
  });
}

export async function findValidPasswordResetToken(
  tokenHash: string,
): Promise<{ id: string; user_id: string } | null> {
  const nowIso = new Date().toISOString();
  const db = getD1Drizzle();
  if (!db) {
    const rec = getLocalStore().password_reset_tokens.find(
      (t) => t.token_hash === tokenHash && t.used_at === null && t.expires_at > nowIso,
    );
    return rec ? { id: rec.id, user_id: rec.user_id } : null;
  }
  const row = await db
    .select({ id: schema.passwordResetTokens.id, userId: schema.passwordResetTokens.userId })
    .from(schema.passwordResetTokens)
    .where(
      and(
        eq(schema.passwordResetTokens.tokenHash, tokenHash),
        isNull(schema.passwordResetTokens.usedAt),
        gte(schema.passwordResetTokens.expiresAt, nowIso),
      ),
    )
    .get();
  return row ? { id: row.id, user_id: row.userId } : null;
}

export async function markPasswordResetTokenUsed(id: string): Promise<void> {
  const now = new Date().toISOString();
  const db = getD1Drizzle();
  if (!db) {
    const rec = getLocalStore().password_reset_tokens.find((t) => t.id === id);
    if (rec) rec.used_at = now;
    return;
  }
  await db
    .update(schema.passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(schema.passwordResetTokens.id, id));
}

export async function saveAvatar(path: string, dataUrl: string): Promise<void> {
  const now = new Date().toISOString();
  const db = getD1Drizzle();
  if (!db) {
    getLocalStore().avatars[path] = dataUrl;
    return;
  }
  await db.insert(schema.avatars).values({ path, dataUrl, createdAt: now }).onConflictDoUpdate({
    target: schema.avatars.path,
    set: { dataUrl },
  });
}

export async function getAvatar(path: string): Promise<string | null> {
  const db = getD1Drizzle();
  if (!db) return getLocalStore().avatars[path] ?? null;
  const row = await db.select().from(schema.avatars).where(eq(schema.avatars.path, path)).get();
  return row?.dataUrl ?? null;
}
