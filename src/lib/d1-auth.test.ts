import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import {
  createSessionToken,
  hashOpaqueToken,
  hashPassword,
  verifyPassword,
  verifySessionToken,
} from "./auth-crypto.server";
import {
  countProfiles,
  countSuperAdmins,
  getProfileByUsername,
  getUserById,
  getUserRoles,
  isD1Configured,
  listAccessRequests,
} from "./db.server";
import { runCheck } from "./integrations.server";

describe("RYZITE D1 & auth runtime", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("hashes passwords with per-user scrypt salt and verifies constant-time", () => {
    const sampleSecret = `Test-${randomBytes(12).toString("hex")}#1`;
    const h1 = hashPassword(sampleSecret);
    const h2 = hashPassword(sampleSecret);
    expect(h1).toMatch(/^scrypt:[a-f0-9]+:[a-f0-9]+$/);
    expect(h1).not.toBe(h2);
    expect(verifyPassword(sampleSecret, h1)).toBe(true);
    expect(verifyPassword("WrongPassword#1", h1)).toBe(false);
  });

  it("signs and verifies session tokens and rejects tampered tokens", () => {
    process.env["SESSION_SECRET"] = "test-signing-secret-for-vitest-only";
    const token = createSessionToken("user-1", "ryziteonline@gmail.com");
    const claims = verifySessionToken(token);
    expect(claims?.sub).toBe("user-1");
    expect(claims?.email).toBe("ryziteonline@gmail.com");

    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.tampered`;
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("hashes opaque reset tokens deterministically with sha256", () => {
    const a = hashOpaqueToken("sample-token");
    const b = hashOpaqueToken("sample-token");
    expect(a).toHaveLength(64);
    expect(a).toBe(b);
  });

  it("seeds local dev store with ryzite_admin super_admin and hashed password", async () => {
    expect(isD1Configured()).toBe(false);
    const admin = await getProfileByUsername("ryzite_admin");
    expect(admin).not.toBeNull();
    const user = admin ? await getUserById(admin.id) : null;
    expect(user).not.toBeNull();
    expect(user?.password_hash).toMatch(/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
    expect(user ? verifyPassword("WrongPassword#99", user.password_hash) : true).toBe(false);
    expect(admin ? await getUserRoles(admin.id) : []).toEqual(["super_admin"]);
    const editor = await getProfileByUsername("editor");
    expect(editor?.email).toBe("nislaryzite@gmail.com");
    const editorUser = editor ? await getUserById(editor.id) : null;
    expect(editorUser?.email).toBe("nislaryzite@gmail.com");
    expect(editorUser?.password_hash).toMatch(/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
    expect(editorUser ? verifyPassword("WrongPassword#99", editorUser.password_hash) : true).toBe(false);
    expect(editor ? await getUserRoles(editor.id) : []).toEqual(["editor"]);
    expect(await countSuperAdmins()).toBe(1);
    expect(await countProfiles()).toBeGreaterThanOrEqual(2);
    const pending = await listAccessRequests("pending");
    expect(pending.length).toBeGreaterThanOrEqual(1);
  });

  it("applies D1 schema and 0001_seed_admin migration idempotently without duplicates", () => {
    const initSql = readFileSync(resolve(process.cwd(), "src/db/d1-migrations/0000_init.sql"), "utf8");
    const seedSql = readFileSync(
      resolve(process.cwd(), "src/db/d1-migrations/0001_seed_admin.sql"),
      "utf8",
    );

    const db = new DatabaseSync(":memory:");
    db.exec(initSql);
    // Run seed migration twice to verify idempotency and no duplicate super_admin accounts
    db.exec(seedSql);
    db.exec(seedSql);

    const adminRows = db
      .prepare(
        `SELECT u.id, u.email, u.password_hash, p.username, r.role
         FROM users u
         JOIN profiles p ON p.id = u.id
         JOIN user_roles r ON r.user_id = u.id
         WHERE p.username = 'ryzite_admin'`,
      )
      .all() as Array<{
      id: string;
      email: string;
      password_hash: string;
      username: string;
      role: string;
    }>;

    expect(adminRows).toHaveLength(1);
    expect(adminRows[0]?.email).toBe("ryziteonline@gmail.com");
    expect(adminRows[0]?.role).toBe("super_admin");
    expect(adminRows[0]?.password_hash).toMatch(/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);

    const superCount = db
      .prepare("SELECT COUNT(*) AS cnt FROM user_roles WHERE role = 'super_admin'")
      .get() as { cnt: number };
    expect(superCount.cnt).toBe(1);
    db.close();
  });

  it("reports GA4, PageSpeed, and AI checks without Lovable or Supabase env dependencies", async () => {
    delete process.env["GA4_PROPERTY_ID"];
    delete process.env["GA4_CLIENT_EMAIL"];
    delete process.env["GA4_PRIVATE_KEY"];
    const ga4 = await runCheck("ga4");
    expect(ga4.state).toBe("configuration_required");
    expect(ga4.missing).toEqual(["GA4_PROPERTY_ID", "GA4_CLIENT_EMAIL", "GA4_PRIVATE_KEY"]);

    const pagespeed = await runCheck("pagespeed");
    expect(pagespeed.state).toBe("planned");

    const ai = await runCheck("ai");
    expect(ai.state).toBe("planned");
    expect(ai.missing).toEqual([]);
  });
});
