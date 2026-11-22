import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "./auth-middleware";
import { passwordProblems } from "./password";
import type { Me } from "./session";

const GENERIC_LOGIN_ERROR = "Those credentials don't match an authorised administrator account.";
const MAX_FAILS_PER_USER = 5;
const MAX_FAILS_PER_IP = 20;
const WINDOW_MIN = 15;

const signInSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_.-]+$/),
  password: z.string().min(1).max(200),
});

export const getAuthStatus = createServerFn({ method: "GET" }).handler(async () => {
  const [{ resolveAuthenticatedSession }, { isD1Configured }] = await Promise.all([
    import("./auth-session.server"),
    import("./db.server"),
  ]);
  const me = await resolveAuthenticatedSession();
  return {
    signedIn: me !== null,
    localDemoMode: !isD1Configured(),
  };
});

export const getCurrentSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ me: Me | null }> => {
    const { resolveAuthenticatedSession } = await import("./auth-session.server");
    const me = await resolveAuthenticatedSession();
    return { me };
  },
);

export const signInWithUsername = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const parsed = signInSchema.safeParse(input);
    return parsed.success ? parsed.data : { username: "", password: "" };
  })
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const [
      { clientInfo, countRecent, writeAudit },
      { createSessionToken, verifyPassword },
      { setSessionCookie },
      { getProfileByUsername, getUserById, getUserRoles, updateProfile },
    ] = await Promise.all([
      import("./audit.server"),
      import("./auth-crypto.server"),
      import("./auth-session.server"),
      import("./db.server"),
    ]);

    const { ip } = clientInfo();
    const username = data.username;

    const fail = async (reason: string) => {
      await writeAudit({
        category: "security",
        action: "auth.login_failed",
        result: "failure",
        subject: username || "(invalid)",
        metadata: { reason },
      });
      return { ok: false as const, error: GENERIC_LOGIN_ERROR };
    };

    if (!username || !data.password) return fail("invalid_input");

    const [userFails, ipFails] = await Promise.all([
      countRecent("auth.login_failed", WINDOW_MIN, { subject: username }),
      ip ? countRecent("auth.login_failed", WINDOW_MIN, { ip }) : Promise.resolve(0),
    ]);
    if (userFails >= MAX_FAILS_PER_USER || ipFails >= MAX_FAILS_PER_IP) {
      await writeAudit({
        category: "security",
        action: "auth.login_blocked",
        result: "blocked",
        subject: username,
        metadata: { userFails, ipFails, windowMinutes: WINDOW_MIN },
      });
      return {
        ok: false,
        error: `Too many failed attempts. Please wait ${WINDOW_MIN} minutes and try again.`,
      };
    }

    const profile = await getProfileByUsername(username);
    if (!profile) return fail("unknown_user");

    const [roles, user] = await Promise.all([getUserRoles(profile.id), getUserById(profile.id)]);
    if (roles.length === 0) return fail("no_role");
    if (!user) return fail("no_user");
    if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) {
      return fail("revoked");
    }

    if (!verifyPassword(data.password, user.password_hash)) {
      return fail("bad_password");
    }

    const token = createSessionToken(user.id, user.email);
    setSessionCookie(token);

    await updateProfile(profile.id, {
      last_sign_in_at: new Date().toISOString(),
      email: user.email,
    });
    await writeAudit({
      category: "security",
      action: "auth.login",
      actorId: profile.id,
      actorLabel: profile.username,
      subject: username,
    });

    return { ok: true };
  });

export const signOutAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const [{ clearSessionCookie, resolveAuthenticatedSession }, { actorLabel, writeAudit }] =
    await Promise.all([import("./auth-session.server"), import("./audit.server")]);
  const me = await resolveAuthenticatedSession();
  if (me) {
    await writeAudit({
      category: "security",
      action: "auth.logout",
      actorId: me.user.id,
      actorLabel: await actorLabel(me.user.id),
    });
  }
  clearSessionCookie();
  return { ok: true as const };
});

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email().max(254),
        origin: z.string().max(300),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const [
      { countRecent, writeAudit },
      { generateOpaqueToken, hashOpaqueToken },
      { createPasswordResetToken, getUserByEmail },
    ] = await Promise.all([
      import("./audit.server"),
      import("./auth-crypto.server"),
      import("./db.server"),
    ]);

    const recent = await countRecent("auth.reset_requested", 60, { subject: data.email });
    if (recent >= 3) {
      await writeAudit({
        category: "security",
        action: "auth.reset_throttled",
        result: "blocked",
        subject: data.email,
      });
      return { ok: true as const };
    }

    const user = await getUserByEmail(data.email);
    if (user) {
      const rawToken = generateOpaqueToken();
      await createPasswordResetToken({
        userId: user.id,
        tokenHash: hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      });
    }

    await writeAudit({
      category: "security",
      action: "auth.reset_requested",
      result: "success",
      subject: data.email,
      metadata: {},
    });
    // Same response whether or not the account exists.
    return { ok: true as const };
  });

export const verifyPasswordResetSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().max(200).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    if (data.token) {
      const [{ hashOpaqueToken }, { findValidPasswordResetToken }] = await Promise.all([
        import("./auth-crypto.server"),
        import("./db.server"),
      ]);
      const found = await findValidPasswordResetToken(hashOpaqueToken(data.token));
      return { valid: found !== null };
    }
    const { resolveAuthenticatedSession } = await import("./auth-session.server");
    const me = await resolveAuthenticatedSession();
    return { valid: me !== null };
  });

export const completePasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().max(200).optional(),
        password: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const problems = passwordProblems(data.password);
    if (problems.length) {
      return { ok: false, error: problems[0] ?? "Password does not meet complexity rules." };
    }

    const [
      { actorLabel, writeAudit },
      { createSessionToken, hashOpaqueToken, hashPassword },
      { resolveAuthenticatedSession, setSessionCookie },
      {
        findValidPasswordResetToken,
        getUserById,
        markPasswordResetTokenUsed,
        updateUserPasswordHash,
      },
    ] = await Promise.all([
      import("./audit.server"),
      import("./auth-crypto.server"),
      import("./auth-session.server"),
      import("./db.server"),
    ]);

    let targetUserId: string | null = null;
    let tokenRecordId: string | null = null;

    if (data.token) {
      const rec = await findValidPasswordResetToken(hashOpaqueToken(data.token));
      if (!rec) {
        return {
          ok: false,
          error: "This reset link is invalid or has expired. Reset links are single-use.",
        };
      }
      targetUserId = rec.user_id;
      tokenRecordId = rec.id;
    } else {
      const me = await resolveAuthenticatedSession();
      if (!me) {
        return {
          ok: false,
          error: "This reset link is invalid or has expired. Reset links are single-use.",
        };
      }
      targetUserId = me.user.id;
    }

    const user = await getUserById(targetUserId);
    if (!user) {
      return { ok: false, error: "Account not found." };
    }

    await updateUserPasswordHash(user.id, hashPassword(data.password));
    if (tokenRecordId) {
      await markPasswordResetTokenUsed(tokenRecordId);
    }
    setSessionCookie(createSessionToken(user.id, user.email));
    await writeAudit({
      category: "security",
      action: "auth.password_changed",
      actorId: user.id,
      actorLabel: await actorLabel(user.id),
    });
    return { ok: true };
  });

const accessSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  reason: z.string().trim().min(10).max(1500),
});

export const submitAccessRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => accessSchema.parse(input))
  .handler(async ({ data }) => {
    const [
      { clientInfo, countRecent, writeAudit },
      { createAccessRequest, findPendingAccessRequestByEmail },
    ] = await Promise.all([import("./audit.server"), import("./db.server")]);

    const { ip } = clientInfo();
    const recentFromIp = ip ? await countRecent("access.requested", 60, { ip }) : 0;
    if (recentFromIp >= 3) {
      return {
        ok: false as const,
        error: "Too many requests from this network. Please try again later.",
      };
    }

    const existing = await findPendingAccessRequestByEmail(data.email);
    if (!existing) {
      const row = await createAccessRequest({
        full_name: data.fullName,
        email: data.email,
        reason: data.reason,
        requester_ip: ip,
      });
      await writeAudit({
        category: "security",
        action: "access.requested",
        subject: data.email,
        entityType: "access_request",
        entityId: row.id,
      });
    }
    return { ok: true as const };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ fullName: z.string().trim().max(120), jobTitle: z.string().trim().max(120) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ updateProfile }, { actorLabel, writeAudit }] = await Promise.all([
      import("./db.server"),
      import("./audit.server"),
    ]);
    await updateProfile(context.userId, {
      full_name: data.fullName,
      job_title: data.jobTitle,
    });
    await writeAudit({
      category: "activity",
      action: "profile.updated",
      actorId: context.userId,
      actorLabel: await actorLabel(context.userId),
      entityType: "profile",
      entityId: context.userId,
    });
    return { ok: true as const };
  });

const ALLOWED_AVATAR_PREFIXES = [
  "data:image/png;base64,",
  "data:image/jpeg;base64,",
  "data:image/webp;base64,",
];

export const uploadMyAvatar = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ext: z.enum(["png", "jpeg", "webp"]),
        dataUrl: z.string().max(4_500_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!ALLOWED_AVATAR_PREFIXES.some((prefix) => data.dataUrl.startsWith(prefix))) {
      return { ok: false as const, error: "Use a PNG, JPG or WebP image." };
    }
    const [{ saveAvatar, updateProfile }, { actorLabel, writeAudit }] = await Promise.all([
      import("./db.server"),
      import("./audit.server"),
    ]);
    const path = `${context.userId}/avatar-${Date.now()}.${data.ext}`;
    await saveAvatar(path, data.dataUrl);
    await updateProfile(context.userId, { avatar_url: path });
    await writeAudit({
      category: "activity",
      action: "profile.avatar_updated",
      actorId: context.userId,
      actorLabel: await actorLabel(context.userId),
      entityType: "profile",
      entityId: context.userId,
    });
    return { ok: true as const, path };
  });

export const getAvatarUrl = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) => z.object({ path: z.string().min(1).max(300) }).parse(input))
  .handler(async ({ data }) => {
    const { getAvatar } = await import("./db.server");
    const url = await getAvatar(data.path);
    return { url };
  });

export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        currentPassword: z.string().min(1).max(200),
        newPassword: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const problems = passwordProblems(data.newPassword);
    if (problems.length) {
      return {
        ok: false as const,
        error: problems[0] ?? "Password does not meet complexity rules.",
      };
    }

    const [
      { getUserById, updateUserPasswordHash },
      { hashPassword, verifyPassword },
      { actorLabel, writeAudit },
    ] = await Promise.all([
      import("./db.server"),
      import("./auth-crypto.server"),
      import("./audit.server"),
    ]);

    const user = await getUserById(context.userId);
    if (!user || !verifyPassword(data.currentPassword, user.password_hash)) {
      return { ok: false as const, error: "Password not changed. Check your current password." };
    }

    await updateUserPasswordHash(user.id, hashPassword(data.newPassword));
    await writeAudit({
      category: "security",
      action: "auth.password_changed",
      actorId: context.userId,
      actorLabel: await actorLabel(context.userId),
    });
    return { ok: true as const };
  });

const ALLOWED_SELF_EVENTS = [
  "auth.logout",
  "auth.password_changed",
  "profile.updated",
  "profile.avatar_updated",
] as const;

export const recordSelfEvent = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z.object({ action: z.enum(ALLOWED_SELF_EVENTS) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { actorLabel, writeAudit } = await import("./audit.server");
    const security = data.action.startsWith("auth.");
    await writeAudit({
      category: security ? "security" : "activity",
      action: data.action,
      actorId: context.userId,
      actorLabel: await actorLabel(context.userId),
      entityType: security ? null : "profile",
      entityId: security ? null : context.userId,
    });
    return { ok: true };
  });
