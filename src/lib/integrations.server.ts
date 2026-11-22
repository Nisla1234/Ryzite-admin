import type { IntegrationKey } from "./nav";
import type { IntegrationCheck } from "./integrations";
import { getD1Database, getRuntimeSecret } from "./runtime-env.server";

const GITHUB_REPO = "Nisla1234/ryzite-unified-platform";
const LIVE_URL = "https://ryzite-unified-platform.ryziteonline.workers.dev/";
const UA = "RYZITE-Control-Centre/1.0 (integration check)";

const has = (name: string) => Boolean(getRuntimeSecret(name));
const missingOf = (names: string[]) => names.filter((n) => !has(n));
const now = () => new Date().toISOString();
const errText = (e: unknown) => (e instanceof Error ? e.message : "Request failed").slice(0, 200);

async function timedFetch(url: string, init: RequestInit = {}, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "user-agent": UA, ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(t);
  }
}

async function checkSanity(): Promise<IntegrationCheck> {
  const token = getRuntimeSecret("SANITY_API_TOKEN");
  const missing = token ? [] : ["SANITY_API_TOKEN"];
  const setup = [
    "Use the existing Sanity project hnm8jy5w. Create or use a development dataset for migration testing; keep production unchanged until review is complete.",
    "Set SANITY_DATASET=development and create a Sanity Editor token named “RYZITE Control Centre” in the existing project.",
    "Configure SANITY_API_TOKEN as a server-side Cloudflare Worker secret (never expose it in the browser).",
    "Add the Control Centre origin under Sanity API -> CORS origins.",
  ];
  try {
    const q = encodeURIComponent(
      '{"docs": count(*[!(_id in path("_.**")) && !(_type match "sanity.*")]), "assets": count(*[_type == "sanity.imageAsset"])}',
    );
    const res = await timedFetch(
      `https://${SANITY_PROJECT}.api.sanity.io/v2024-01-01/data/query/${SANITY_DATASET}?query=${q}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!res.ok) {
      return {
        key: "sanity",
        state: "disconnected",
        summary: `Sanity answered with HTTP ${res.status}.`,
        capabilities: [{ label: "Read published content", ok: false }],
        missing,
        error: (await res.text()).slice(0, 200),
        setup,
        checkedAt: now(),
      };
    }
    const body = (await res.json()) as { result?: { docs?: number; assets?: number } };
    const docs = body.result?.docs ?? 0;
    const assets = body.result?.assets ?? 0;
    const canWrite = missing.length === 0;
    return {
      key: "sanity",
      state: canWrite ? "connected" : "configuration_required",
      summary: `Project ${SANITY_PROJECT} / ${SANITY_DATASET} is reachable: ${docs} content document${docs === 1 ? "" : "s"}, ${assets} image${assets === 1 ? "" : "s"}.`,
      capabilities: [
        { label: "Read published content", ok: true },
        {
          label: "Sanity server token configured",
          ok: canWrite,
          ...(canWrite ? { detail: "Token is available for the next CMS integration phase; the admin editing interface is not enabled yet." } : { detail: "Needs SANITY_API_TOKEN configured server-side." }),
        },
      ],
      missing,
      setup,
      checkedAt: now(),
    };
  } catch (e) {
    return {
      key: "sanity",
      state: "disconnected",
      summary: "Sanity could not be reached.",
      capabilities: [{ label: "Read published content", ok: false }],
      missing,
      error: errText(e),
      setup,
      checkedAt: now(),
    };
  }
}

async function checkGithub(): Promise<IntegrationCheck> {
  const token = getRuntimeSecret("GITHUB_TOKEN");
  const setup = [
    "Live website repo: Nisla1234/ryzite-unified-platform (main). Control Centre repo: Nisla1234/Ryzite-admin.",
    "Public repository metadata can be read directly via the GitHub REST API without extra secrets.",
    "The live website repository is public, so read-only status checks work without a token. If rate limits require it, configure a narrowly scoped read-only GITHUB_TOKEN; do not grant write access for CMS editing.",
  ];
  try {
    const res = await timedFetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.ok) {
      const repo = (await res.json()) as { private?: boolean; default_branch?: string };
      return {
        key: "github",
        state: "connected",
        summary: `GitHub repository ${GITHUB_REPO} is reachable (default branch ${repo.default_branch ?? "main"}).`,
        capabilities: [
          { label: "Read repository metadata", ok: true },
          {
            label: "Read website repository metadata",
            ok: true,
            ...(token ? {} : { detail: "Public repository; no token required for basic reads." }),
          },
        ],
        missing: [],
        setup,
        checkedAt: now(),
      };
    }
    return {
      key: "github",
      state: "configuration_required",
      summary: `GitHub answered with HTTP ${res.status}. Private repositories require a standard GITHUB_TOKEN.`,
      capabilities: [{ label: "Read repository metadata and files", ok: false }],
      missing: token ? [] : ["GITHUB_TOKEN (only if repository is private)"],
      error: (await res.text()).slice(0, 200),
      setup,
      checkedAt: now(),
    };
  } catch (e) {
    return {
      key: "github",
      state: "disconnected",
      summary: "GitHub could not be reached.",
      capabilities: [],
      missing: [],
      error: errText(e),
      setup,
      checkedAt: now(),
    };
  }
}

function checkGa4(): IntegrationCheck {
  const missing = missingOf(["GA4_PROPERTY_ID", "GA4_CLIENT_EMAIL", "GA4_PRIVATE_KEY"]);
  return {
    key: "ga4",
    state: missing.length ? "configuration_required" : "planned",
    summary: missing.length
      ? "No Google Analytics credentials are saved, and the live website has no GA4 tag yet. No traffic numbers are shown anywhere until this is connected."
      : "Credentials are saved. The GA4 reporting screens arrive in a later phase.",
    capabilities: [
      {
        label: "Read GA4 reports",
        ok: false,
        detail: missing.length ? "Credentials missing." : "Reporting not built yet.",
      },
    ],
    missing,
    setup: [
      "In Google Analytics, open (or create) the RYZITE web property and copy its numeric Property ID.",
      "In Google Cloud, create a service account, enable the “Google Analytics Data API”, and create a JSON key.",
      "In GA4 -> Admin -> Property access management, add the service account email as a Viewer.",
      "Save GA4_PROPERTY_ID, GA4_CLIENT_EMAIL and GA4_PRIVATE_KEY as server-side secrets.",
    ],
    checkedAt: now(),
  };
}

function checkPagespeed(): IntegrationCheck {
  const keyed = has("PAGESPEED_API_KEY");
  return {
    key: "pagespeed",
    state: "planned",
    summary: `Lighthouse reports arrive in a later phase. ${keyed ? "An API key is saved." : "Google's service works without a key at low volume; a key is recommended for scheduled reports."}`,
    capabilities: [{ label: "Run Lighthouse reports", ok: false, detail: "Not built yet." }],
    missing: keyed ? [] : ["PAGESPEED_API_KEY (optional)"],
    setup: [
      "In Google Cloud, enable the PageSpeed Insights API and create an API key.",
      "Save it as the server-side secret PAGESPEED_API_KEY.",
    ],
    checkedAt: now(),
  };
}

async function checkCloudflare(): Promise<IntegrationCheck> {
  const token = getRuntimeSecret("CLOUDFLARE_API_TOKEN");
  const accountId = getRuntimeSecret("CLOUDFLARE_ACCOUNT_ID");
  const missing = missingOf(["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]);
  const d1Bound = getD1Database() !== null;
  const setup = [
    "In Cloudflare -> My Profile -> API Tokens, create a scoped token for Workers & D1 automation.",
    "Save CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID as server-side secrets.",
    "Ensure the D1 binding DB is linked in wrangler.jsonc before deploying to Cloudflare Workers.",
  ];
  const started = Date.now();
  try {
    const res = await timedFetch(LIVE_URL, { redirect: "manual" });
    const ms = Date.now() - started;
    const up = res.status >= 200 && res.status < 400;

    let tokenActive = false;
    if (token) {
      try {
        const verify = await timedFetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (verify.ok) {
          const body = (await verify.json()) as {
            success?: boolean;
            result?: { status?: string };
          };
          tokenActive = body.success === true && body.result?.status === "active";
        }
      } catch {
        tokenActive = false;
      }
    }

    const tokenInvalid = Boolean(token) && !tokenActive;
    const state = !up || tokenInvalid
      ? "disconnected"
      : missing.length
        ? "configuration_required"
        : "connected";

    return {
      key: "cloudflare",
      state,
      summary: up
        ? `Live site answered in ${ms} ms (HTTP ${res.status}). ${tokenActive ? "Cloudflare API token is active." : token ? "Cloudflare API token could not be verified." : "Cloudflare API token is not configured."} ${d1Bound ? "D1 binding is available in this runtime." : "D1 binding is not available in this local runtime."}`
        : `The live website answered with HTTP ${res.status}.`,
      capabilities: [
        { label: "Live website responds", ok: up },
        {
          label: "Cloudflare API token is active",
          ok: tokenActive,
          ...(!tokenActive
            ? { detail: token ? "Token verification failed." : "CLOUDFLARE_API_TOKEN is not configured." }
            : {}),
        },
        {
          label: "Cloudflare account ID configured",
          ok: Boolean(accountId),
          ...(!accountId ? { detail: "CLOUDFLARE_ACCOUNT_ID is not configured." } : {}),
        },
        {
          label: "D1 database binding",
          ok: d1Bound,
          ...(!d1Bound ? { detail: "The binding is available when running in the configured Cloudflare Workers environment." } : {}),
        },
        {
          label: "Read deployment history",
          ok: false,
          detail: "Deployment history retrieval is not implemented yet.",
        },
      ],
      missing,
      setup,
      checkedAt: now(),
    };
  } catch (e) {
    return {
      key: "cloudflare",
      state: "disconnected",
      summary: "The live website could not be reached.",
      capabilities: [{ label: "Live website responds", ok: false }],
      missing,
      error: errText(e),
      setup,
      checkedAt: now(),
    };
  }
}

function checkAi(): IntegrationCheck {
  return {
    key: "ai",
    state: "planned",
    summary:
      "AI reporting and recommendations are scheduled for Phase 7 using direct server-side provider integration. No reports publish automatically.",
    capabilities: [
      { label: "Generate reports and suggestions", ok: false, detail: "Scheduled for Phase 7." },
    ],
    missing: [],
    setup: [
      "AI recommendation workflows will be configured directly on Cloudflare Workers in Phase 7.",
    ],
    checkedAt: now(),
  };
}

function checkEmail(): IntegrationCheck {
  return {
    key: "email",
    state: "planned",
    summary:
      "Transactional email delivery for password resets, invitations and alerts will use a verified domain sender in a later phase.",
    capabilities: [
      { label: "Password reset token management", ok: true, detail: "Handled in Cloudflare D1." },
      { label: "Branded alerts and email delivery", ok: false, detail: "Not built yet." },
    ],
    missing: [],
    setup: [
      "Verify a domain you own (for example ryzite.com) with your transactional email provider.",
    ],
    checkedAt: now(),
  };
}

export async function runCheck(key: IntegrationKey): Promise<IntegrationCheck> {
  switch (key) {
    case "sanity":
      return checkSanity();
    case "github":
      return checkGithub();
    case "ga4":
      return checkGa4();
    case "pagespeed":
      return checkPagespeed();
    case "cloudflare":
      return checkCloudflare();
    case "ai":
      return checkAi();
    case "email":
      return checkEmail();
  }
}
