import { getRequest } from "@tanstack/react-start/server";
import { countRecentAuditLogs, getProfileById, insertAuditLog } from "./db.server";
import type { JsonValue } from "./session";

export function clientInfo() {
  const req = getRequest();
  const h = req?.headers;
  const ip =
    h?.get("cf-connecting-ip") ??
    h?.get("x-real-ip") ??
    h?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const userAgent = h?.get("user-agent")?.slice(0, 300) ?? null;
  const origin = h?.get("origin") ?? null;
  return { ip, userAgent, origin };
}

export interface AuditEntry {
  category: "activity" | "security";
  action: string;
  result?: "success" | "failure" | "blocked";
  actorId?: string | null;
  actorLabel?: string | null;
  subject?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, JsonValue | undefined>;
}

/** Writes an audit row. Never pass passwords, tokens or other credentials in metadata. */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  const { ip, userAgent } = clientInfo();
  try {
    await insertAuditLog({
      category: entry.category,
      action: entry.action,
      result: entry.result ?? "success",
      actor_id: entry.actorId ?? null,
      actor_label: entry.actorLabel ?? null,
      subject: entry.subject ?? null,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
      ip,
      user_agent: userAgent,
    });
  } catch (error) {
    console.error("[audit] insert failed", error instanceof Error ? error.message : String(error));
  }
}

export async function countRecent(
  action: string,
  minutes: number,
  filter: { subject?: string; ip?: string | null },
): Promise<number> {
  const sinceIso = new Date(Date.now() - minutes * 60_000).toISOString();
  return countRecentAuditLogs({
    action,
    sinceIso,
    ...(filter.subject ? { subject: filter.subject } : {}),
    ...(filter.ip ? { ip: filter.ip } : {}),
  });
}

/** Accepts only http(s) origins; returns the admin reset URL on that origin. */
export function resetRedirect(origin: string | null | undefined): string | undefined {
  if (!origin) return undefined;
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:" && u.hostname !== "localhost") return undefined;
    return `${u.origin}/admin/reset-password`;
  } catch {
    return undefined;
  }
}

export async function actorLabel(userId: string): Promise<string | null> {
  const profile = await getProfileById(userId);
  return profile?.username ?? null;
}
