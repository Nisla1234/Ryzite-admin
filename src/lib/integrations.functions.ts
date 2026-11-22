import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "./auth-middleware";
import { INTEGRATION_ORDER } from "./integrations";

const keyEnum = z.enum(["sanity", "ga4", "pagespeed", "ai", "email", "github", "cloudflare"]);

/** Current status of every service. Any signed-in administrator may read it; no secret values are returned. */
export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () => {
    const [{ runCheck }, { listAuditLogs }] = await Promise.all([
      import("./integrations.server"),
      import("./db.server"),
    ]);
    const [checks, recentTests] = await Promise.all([
      Promise.all(INTEGRATION_ORDER.map((k) => runCheck(k))),
      listAuditLogs({ action: "integration.test", result: "success", limit: 200 }),
    ]);
    const lastSuccess: Record<string, string> = {};
    for (const row of recentTests) {
      if (row.entity_id && !lastSuccess[row.entity_id]) {
        lastSuccess[row.entity_id] = row.created_at;
      }
    }
    return { checks, lastSuccess };
  });

/** Super Admin "Test connection": re-runs one check and records the outcome in the activity log. */
export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) => z.object({ key: keyEnum }).parse(input))
  .handler(async ({ data, context }) => {
    if (!context.roles.includes("super_admin")) {
      throw new Error("Forbidden: Super Admin access is required.");
    }
    const [{ runCheck }, { actorLabel, writeAudit }] = await Promise.all([
      import("./integrations.server"),
      import("./audit.server"),
    ]);
    const check = await runCheck(data.key);
    const reachable = check.state !== "disconnected" && check.capabilities.some((c) => c.ok);
    await writeAudit({
      category: "activity",
      action: "integration.test",
      result: reachable ? "success" : "failure",
      actorId: context.userId,
      actorLabel: await actorLabel(context.userId),
      entityType: "integration",
      entityId: data.key,
      metadata: { state: check.state, summary: check.summary.slice(0, 200) },
    });
    return check;
  });
