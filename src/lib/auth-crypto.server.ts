import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getRuntimeSecret } from "./runtime-env.server";

const EPHEMERAL_SECRET_KEY = "__RYZITE_EPHEMERAL_SESSION_SECRET__";
const SESSION_TTL_SECONDS = 86_400; // 24 hours

function getSessionSecret(): Buffer {
  const configured = getRuntimeSecret("SESSION_SECRET") ?? getRuntimeSecret("AUTH_SECRET");
  if (configured) {
    return createHash("sha256").update(configured, "utf8").digest();
  }
  const g = globalThis as Record<string, unknown>;
  if (!(g[EPHEMERAL_SECRET_KEY] instanceof Uint8Array)) {
    g[EPHEMERAL_SECRET_KEY] = randomBytes(32);
  }
  return Buffer.from(g[EPHEMERAL_SECRET_KEY] as Uint8Array);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const expectedHex = parts[2];
  if (!salt || !expectedHex) return false;
  try {
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export interface SessionClaims {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

export function createSessionToken(userId: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }), "utf8").toString(
    "base64url",
  );
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, email, iat: now, exp: now + SESSION_TTL_SECONDS }),
    "utf8",
  ).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", getSessionSecret())
    .update(signingInput, "utf8")
    .digest("base64url");
  return `${signingInput}.${signature}`;
}

export function verifySessionToken(token: string): SessionClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) return null;

  const signingInput = `${header}.${payload}`;
  const expectedSig = createHmac("sha256", getSessionSecret())
    .update(signingInput, "utf8")
    .digest("base64url");

  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<SessionClaims>;
    if (typeof parsed.sub !== "string" || typeof parsed.email !== "string") return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      sub: parsed.sub,
      email: parsed.email,
      iat: typeof parsed.iat === "number" ? parsed.iat : 0,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function generateOpaqueToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
