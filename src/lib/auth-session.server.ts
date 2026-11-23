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

export function detectHttpsFromHeaders(
  protocol: string | undefined,
  headers: Pick<Headers, "get"> | null | undefined,
): boolean {
  if (protocol?.toLowerCase() === "https") return true;
  if (!headers) return false;

  const xfp = headers.get("x-forwarded-proto")?.toLowerCase() ?? "";
  if (xfp.split(",").some((part) => part.trim() === "https")) return true;

  const forwarded = headers.get("forwarded")?.toLowerCase() ?? "";
  if (/proto=https\b/.test(forwarded)) return true;

  if (headers.get("x-forwarded-ssl")?.toLowerCase() === "on") return true;

  const cfVisitor = headers.get("cf-visitor")?.toLowerCase() ?? "";
  if (cfVisitor.includes('"scheme":"https"')) return true;

  const origin = headers.get("origin")?.toLowerCase() ?? "";
  if (origin.startsWith("https://")) return true;

  const referer = headers.get("referer")?.toLowerCase() ?? "";
  if (referer.startsWith("https://")) return true;

  return false;
}

export function buildSessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    sameSite: (secure ? "none" : "lax") as "none" | "lax",
    secure,
    ...(secure ? { partitioned: true } : {}),
  };
}

function isHttpsRequest(): boolean {
  try {
    const proto = getRequestProtocol();
    const req = getRequest();
    return detectHttpsFromHeaders(proto, req?.headers);
  } catch {
    return false;
  }
}

export function setSessionCookie(token: string): void {
  setCookie(SESSION_COOKIE_NAME, token, buildSessionCookieOptions(isHttpsRequest()));
}

export function clearSessionCookie(): void {
  const { maxAge: _maxAge, ...deleteOpts } = buildSessionCookieOptions(isHttpsRequest());
  deleteCookie(SESSION_COOKIE_NAME, deleteOpts);
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
