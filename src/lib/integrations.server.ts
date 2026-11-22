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

async function checkWebsiteContent(): Promise<IntegrationCheck> {
  const token = getRuntimeSecret("GITHUB_TOKEN");
  const setup = [
    "The live website content is source-controlled in Nisla1234/ryzite-unified-platform, branch main.",
    "Content files are read from src/data and media inventory is read from public/assets.",
    "Content changes can be proposed as draft pull requests when GITHUB_TOKEN has Contents: write and Pull requests: write on the website repository.",
    "The repository is public, so no token is required for basic reads. A narrowly scoped GITHUB_TOKEN can improve rate limits and enable a future PR workflow.",
  ];
  try {
    const res = await timedFetch(
      `https://api.github.com/repos/${GITHUB_REPO}/git/trees/main?recursive=1`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      12000,
    );
    if (!res.ok) {
      return {
        key: "content",
        state: "disconnected",
        summary: `GitHub content inventory returned HTTP ${res.status}.`,
        capabilities: [{ label: "Read website content source", ok: false }],
        missing: [],
        error: (await res.text()).slice(0, 200),
        setup,
        checkedAt: now(),
      };
    }
    const body = (await res.json()) as {
      truncated?: boolean;
      tree?: Array<{ path: string; type: string; size?: number }>;
    };
    const entries = (body.tree ?? []).filter((entry) => entry.type === "blob");
    const contentFiles = entries.filter(
      (entry) =>
        entry.path.startsWith("src/data/") &&
        /\.(ts|tsx|js|json|md)$/i.test(entry.path) &&
        !/\.(test|spec)\./i.test(entry.path),
    );
    const mediaFiles = entries.filter(
      (entry) =>
        entry.path.startsWith("public/assets/") &&
        /\.(png|jpe?g|webp|avif|svg|gif|mp4|webm)$/i.test(entry.path),
    );
    const ok = contentFiles.length > 0;
    return {
      key: "content",
      state: ok ? "connected" : "configuration_required",
      summary: ok
        ? `Read access verified for ${GITHUB_REPO}: ${contentFiles.length} content source files and ${mediaFiles.length} public media assets on main.${body.truncated ? " GitHub marked the inventory as truncated." : ""}`
        : "The repository responded, but no supported content source files were found under src/data.",
      capabilities: [
        { label: "Read website content source files", ok },
        { label: "Inventory public media assets", ok: mediaFiles.length > 0 },
        {
          label: "Propose website content changes as a draft pull request",
          ok: Boolean(token),
          ...(!token
            ? { detail: "Configure server-side GITHUB_TOKEN with Contents: write and Pull requests: write on the website repository." }
            : {}),
        },
      ],
      missing: [],
      setup,
      checkedAt: now(),
    };
  } catch (e) {
    return {
      key: "content",
      state: "disconnected",
      summary: "The live website content repository could not be reached.",
      capabilities: [{ label: "Read website content source", ok: false }],
      missing: [],
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
    "Configure GITHUB_TOKEN as a Cloudflare Worker secret with Contents: read/write and Pull requests: read/write on the website repository to enable reviewed content publishing.",
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
            label: "Propose changes as a pull request",
            ok: Boolean(token),
            ...(token
              ? {}
              : { detail: "Optional GITHUB_TOKEN not configured; manual git/GitHub sync active." }),
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
    case "content":
      return checkWebsiteContent();
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
