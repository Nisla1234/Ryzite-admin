import {
  deleteCookie,
  getCookie,
  getRequest,
  getRequestProtocol,
  setCookie,
} from "@tanstack/react-start/server";
import { verifySessionToken } from "./auth-crypto.server";
import { getProfileById, getUserById, getUserRoles } from "./db.server";
import { isRole, type Role } from "./permissions";
import type { Me } from "./session";

export const SESSION_COOKIE_NAME = "ryzite_session";
const SESSION_MAX_AGE_SECONDS = 86_400;

function isHttpsRequest(): boolean {
  try {
    const proto = getRequestProtocol();
    if (proto === "https") return true;
    const req = getRequest();
    return req?.headers.get("x-forwarded-proto") === "https";
  } catch {
    return false;
  }
}

export function setSessionCookie(token: string): void {
  const secure = isHttpsRequest();
  setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    sameSite: secure ? "none" : "lax",
    secure,
    ...(secure ? { partitioned: true } : {}),
  });
}

export function clearSessionCookie(): void {
  const secure = isHttpsRequest();
  deleteCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure,
    ...(secure ? { partitioned: true } : {}),
  });
}

function readTokenFromRequest(): string | null {
  try {
    const fromCookie = getCookie(SESSION_COOKIE_NAME);
    if (fromCookie) return fromCookie;
    const req = getRequest();
    const authHeader = req?.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice(7).trim() || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function resolveAuthenticatedSession(): Promise<Me | null> {
  const token = readTokenFromRequest();
  if (!token) return null;

  const claims = verifySessionToken(token);
  if (!claims) return null;

  const [user, profile, rawRoles] = await Promise.all([
    getUserById(claims.sub),
    getProfileById(claims.sub),
    getUserRoles(claims.sub),
  ]);
  if (!user || !profile) return null;
  if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) {
    return null;
  }

  const roles: Role[] = rawRoles.filter(isRole);
  if (roles.length === 0) return null;

  return {
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: profile.last_sign_in_at,
    },
    profile,
    roles,
  };
}
