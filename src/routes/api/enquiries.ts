import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { countRecentAuditLogs, insertAuditLog } from "@/lib/db.server";
import { createEnquiry } from "@/lib/platform-db.server";
import { getRuntimeSecret } from "@/lib/runtime-env.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-ryzite-webhook-secret",
};

const enquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  business: z.string().trim().max(160).optional().default(""),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().default(""),
  service: z.string().trim().max(120).optional().default(""),
  subject: z.string().trim().max(160).optional().default(""),
  message: z.string().trim().min(5).max(4000),
  source_page: z.string().trim().max(200).optional().default("/contact"),
  category: z.string().trim().max(60).optional().default("general"),
  botcheck: z.string().optional().default(""),
});

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/enquiries")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-real-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          null;
        const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;

        const configuredSecret = getRuntimeSecret("ENQUIRY_WEBHOOK_SECRET");
        const providedSecret = request.headers.get("x-ryzite-webhook-secret");
        let trustedWebhook = false;

        if (providedSecret !== null) {
          if (!configuredSecret || !secretsMatch(providedSecret, configuredSecret)) {
            return Response.json(
              { ok: false, error: "Invalid webhook secret." },
              { status: 401, headers: CORS_HEADERS },
            );
          }
          trustedWebhook = true;
        }

        let raw: unknown;
        const contentType = request.headers.get("content-type") ?? "";
        try {
          if (contentType.includes("application/json")) {
            raw = await request.json();
          } else if (
            contentType.includes("application/x-www-form-urlencoded") ||
            contentType.includes("multipart/form-data")
          ) {
            const form = await request.formData();
            raw = Object.fromEntries(form.entries());
          } else {
            raw = await request.json();
          }
        } catch {
          return Response.json(
            { ok: false, error: "Invalid request payload." },
            { status: 400, headers: CORS_HEADERS },
          );
        }

        const parsed = enquirySchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json(
            { ok: false, error: "Please check your name, email, and message." },
            { status: 400, headers: CORS_HEADERS },
          );
        }

        // Silent honeypot discard for automated bots
        if (parsed.data.botcheck.trim().length > 0) {
          return Response.json(
            { ok: true, id: "accepted" },
            { status: 200, headers: CORS_HEADERS },
          );
        }

        if (!trustedWebhook && ip) {
          const sinceIso = new Date(Date.now() - 15 * 60_000).toISOString();
          const recent = await countRecentAuditLogs({
            action: "enquiry.received",
            sinceIso,
            ip,
          });
          if (recent >= 10) {
            return Response.json(
              {
                ok: false,
                error: "Too many submissions from this network. Please try again later.",
              },
              { status: 429, headers: CORS_HEADERS },
            );
          }
        }

        const created = await createEnquiry({
          name: parsed.data.name,
          business: parsed.data.business,
          email: parsed.data.email,
          phone: parsed.data.phone,
          service: parsed.data.service,
          subject: parsed.data.subject,
          message: parsed.data.message,
          source_page: parsed.data.source_page,
          category: parsed.data.category,
          requester_ip: ip,
        });

        await insertAuditLog({
          category: "activity",
          action: "enquiry.received",
          result: "success",
          actor_id: null,
          actor_label: parsed.data.email,
          subject: parsed.data.email,
          entity_type: "enquiry",
          entity_id: created.id,
          metadata: { source_page: parsed.data.source_page, trustedWebhook },
          ip,
          user_agent: userAgent,
        });

        return Response.json(
          { ok: true, id: created.id, createdAt: created.created_at },
          { status: 201, headers: CORS_HEADERS },
        );
      },
    },
  },
});
