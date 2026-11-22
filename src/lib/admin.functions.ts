import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "./auth-middleware";
import { can, ROLES, type Permission, type Role } from "./permissions";

function assertSuperAdmin(roles: Role[]) {
  if (!roles.includes("super_admin")) {
    throw new Error("Forbidden: Super Admin access is required.");
  }
}

function assertPermission(roles: Role[], permission: Permission) {
  if (!can(roles, permission)) {
    throw new Error(`Forbidden: Missing permission ${permission}.`);
  }
}

const roleEnum = z.enum(ROLES);
const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9_.-]+$/, "Use 3–32 lowercase letters, numbers, dots, dashes or underscores.");

export const getDashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    assertPermission(context.roles, "dashboard.view");
    const { countPendingAccessRequests, countProfiles, listAuditLogs } =
      await import("./db.server");
    const isSuper = can(context.roles, "access.review");
    const [recentActivity, members, pending] = await Promise.all([
      listAuditLogs({ limit: 8 }),
      countProfiles(),
      isSuper ? countPendingAccessRequests() : Promise.resolve(null),
    ]);
    return {
      activity: recentActivity.map((a) => ({
        id: a.id,
        action: a.action,
        actor_label: a.actor_label,
        subject: a.subject,
        result: a.result,
        created_at: a.created_at,
      })),
      members,
      pending,
    };
  });

export const getPendingAccessCount = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    if (!can(context.roles, "access.review")) return { count: 0 };
    const { countPendingAccessRequests } = await import("./db.server");
    return { count: await countPendingAccessRequests() };
  });

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    assertPermission(context.roles, "users.manage");
    const { listAllUserRoles, listProfiles } = await import("./db.server");
    const [profiles, roles] = await Promise.all([listProfiles(), listAllUserRoles()]);
    return profiles.map((p) => ({
      ...p,
      roles: roles.filter((r) => r.user_id === p.id).map((r) => r.role),
    }));
  });

export const listAccessRequests = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z.object({ status: z.enum(["pending", "approved", "rejected"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(context.roles, "access.review");
    const { listAccessRequests: queryRequests } = await import("./db.server");
    return queryRequests(data.status);
  });

export const getAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z.object({ category: z.enum(["activity", "security"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPermission(
      context.roles,
      data.category === "activity" ? "logs.activity" : "logs.security",
    );
    const { listAuditLogs } = await import("./db.server");
    return listAuditLogs({ category: data.category, limit: 500 });
  });

export const approveAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        role: roleEnum,
        username: usernameSchema,
        origin: z.string().max(300),
        note: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertSuperAdmin(context.roles);
    const [
      { actorLabel, writeAudit },
      { generateOpaqueToken, hashOpaqueToken, hashPassword },
      {
        createPasswordResetToken,
        createUserAccount,
        getAccessRequestById,
        getProfileByUsername,
        getUserByEmail,
        updateAccessRequestDecision,
      },
    ] = await Promise.all([
      import("./audit.server"),
      import("./auth-crypto.server"),
      import("./db.server"),
    ]);

    const label = await actorLabel(context.userId);
    const req = await getAccessRequestById(data.id);
    if (!req) return { ok: false as const, error: "Request not found." };
    if (req.status !== "pending") {
      return { ok: false as const, error: "This request has already been decided." };
    }

    const taken = await getProfileByUsername(data.username);
    if (taken) return { ok: false as const, error: "That username is already in use." };

    const existingUser = await getUserByEmail(req.email);
    if (existingUser) {
      await writeAudit({
        category: "activity",
        action: "access.approve",
        result: "failure",
        actorId: context.userId,
        actorLabel: label,
        entityType: "access_request",
        entityId: req.id,
        metadata: { error: "Account already exists" },
      });
      return { ok: false as const, error: "An account with this email already exists." };
    }

    const tempSecret = generateOpaqueToken();
    const { id: userId } = await createUserAccount({
      email: req.email,
      passwordHash: hashPassword(tempSecret),
      username: data.username,
      fullName: req.full_name,
      role: data.role,
    });

    const inviteToken = generateOpaqueToken();
    await createPasswordResetToken({
      userId,
      tokenHash: hashOpaqueToken(inviteToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    });

    await updateAccessRequestDecision(req.id, {
      status: "approved",
      assigned_role: data.role,
      decided_by: context.userId,
      decided_at: new Date().toISOString(),
      decision_note: data.note ?? null,
    });

    await writeAudit({
      category: "security",
      action: "access.approved",
      actorId: context.userId,
      actorLabel: label,
      subject: req.email,
      entityType: "access_request",
      entityId: req.id,
      metadata: { role: data.role, username: data.username },
    });
    return {
      ok: true as const,
      invitePath: `/admin/reset-password?token=${encodeURIComponent(inviteToken)}`,
    };
  });

export const rejectAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertSuperAdmin(context.roles);
    const [{ actorLabel, writeAudit }, { getAccessRequestById, updateAccessRequestDecision }] =
      await Promise.all([import("./audit.server"), import("./db.server")]);

    const req = await getAccessRequestById(data.id);
    if (!req || req.status !== "pending") {
      return { ok: false as const, error: "This request is no longer pending." };
    }
    await updateAccessRequestDecision(req.id, {
      status: "rejected",
      decided_by: context.userId,
      decided_at: new Date().toISOString(),
      decision_note: data.note ?? null,
    });
    await writeAudit({
      category: "security",
      action: "access.rejected",
      actorId: context.userId,
      actorLabel: await actorLabel(context.userId),
      subject: req.email,
      entityType: "access_request",
      entityId: req.id,
    });
    return { ok: true as const };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), role: roleEnum }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertSuperAdmin(context.roles);
    const [{ actorLabel, writeAudit }, { countSuperAdmins, getUserRoles, replaceUserRole }] =
      await Promise.all([import("./audit.server"), import("./db.server")]);

    const current = await getUserRoles(data.userId);
    const wasSuper = current.includes("super_admin");
    if (wasSuper && data.role !== "super_admin" && (await countSuperAdmins()) <= 1) {
      return { ok: false as const, error: "At least one Super Admin must remain." };
    }
    await replaceUserRole(data.userId, data.role);
    await writeAudit({
      category: "security",
      action: "user.role_changed",
      actorId: context.userId,
      actorLabel: await actorLabel(context.userId),
      entityType: "user",
      entityId: data.userId,
      metadata: { from: current, to: data.role },
    });
    return { ok: true as const };
  });

export const revokeUserAccess = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    assertSuperAdmin(context.roles);
    if (data.userId === context.userId) {
      return { ok: false as const, error: "You can't revoke your own access." };
    }
    const [
      { actorLabel, writeAudit },
      { countSuperAdmins, deleteUserRoles, getUserRoles, setUserBannedUntil },
    ] = await Promise.all([import("./audit.server"), import("./db.server")]);

    const current = await getUserRoles(data.userId);
    if (current.includes("super_admin") && (await countSuperAdmins()) <= 1) {
      return { ok: false as const, error: "At least one Super Admin must remain." };
    }
    await deleteUserRoles(data.userId);
    await setUserBannedUntil(
      data.userId,
      new Date(Date.now() + 100 * 365 * 86_400_000).toISOString(),
    );
    await writeAudit({
      category: "security",
      action: "user.access_revoked",
      actorId: context.userId,
      actorLabel: await actorLabel(context.userId),
      entityType: "user",
      entityId: data.userId,
      metadata: { previousRoles: current },
    });
    return { ok: true as const };
  });

export const restoreUserAccess = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), role: roleEnum }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertSuperAdmin(context.roles);
    const [{ actorLabel, writeAudit }, { replaceUserRole, setUserBannedUntil }] = await Promise.all(
      [import("./audit.server"), import("./db.server")],
    );

    await setUserBannedUntil(data.userId, null);
    await replaceUserRole(data.userId, data.role);
    await writeAudit({
      category: "security",
      action: "user.access_restored",
      actorId: context.userId,
      actorLabel: await actorLabel(context.userId),
      entityType: "user",
      entityId: data.userId,
      metadata: { role: data.role },
    });
    return { ok: true as const };
  });

/** Live availability check of the public website (real HTTP request, server-side). */
export const checkLiveSite = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () => {
    const url = "https://ryzite-website.thulirkalcom.workers.dev/";
    const started = Date.now();
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: { "user-agent": "RYZITE-Control-Centre/1.0 (health check)" },
      });
      const ms = Date.now() - started;
      const html = res.status === 200 ? await res.text() : "";
      const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
      return {
        ok: res.status >= 200 && res.status < 400,
        status: res.status,
        ms,
        title,
        checkedAt: new Date().toISOString(),
        url,
      };
    } catch (e) {
      return {
        ok: false,
        status: 0,
        ms: Date.now() - started,
        title: null,
        checkedAt: new Date().toISOString(),
        url,
        error: e instanceof Error ? e.message : "Request failed",
      };
    }
  });
