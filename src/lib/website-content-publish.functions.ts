import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "./auth-middleware";
import { can } from "./permissions";
import { getRuntimeSecret } from "./runtime-env.server";

const REPOSITORY = "Nisla1234/ryzite-unified-platform";
const API = "https://api.github.com";
const allowedRoots = ["src/data/", "src/pages/", "src/components/sections/", "src/layouts/"];
const allowedExtension = /\.(astro|ts|tsx|js|json|md)$/i;

function headers(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "RYZITE-Control-Centre/1.0",
  };
}

function validatePath(path: string) {
  if (
    !allowedRoots.some((root) => path.startsWith(root)) ||
    path.split("/").some((part) => part === ".." || part === "") ||
    !allowedExtension.test(path)
  ) {
    throw new Error("This file is outside the permitted website content folders.");
  }
}

async function githubRequest(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers(token), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({})) as {
    message?: string;
    sha?: string;
    object?: { sha?: string };
    content?: string;
    type?: string;
    html_url?: string;
    ref?: string;
    number?: number;
  };
  if (!response.ok) {
    const detail = response.status === 401 || response.status === 403
      ? "GitHub rejected the token or its permissions. Give GITHUB_TOKEN Contents: read/write and Pull requests: read/write access to the website repository."
      : body.message ?? `GitHub API returned HTTP ${response.status}.`;
    throw new Error(detail);
  }
  return body;
}

function toBase64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Never writes to main. Creates a dedicated branch and a pull request for human review.
 * The website's production deployment remains controlled by its existing GitHub/Cloudflare pipeline.
 */
export const createWebsiteContentPullRequest = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z.object({
      path: z.string().min(1).max(500),
      content: z.string().max(400_000),
      title: z.string().trim().min(8).max(120),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!can(context.roles, "content.publish")) {
      throw new Error("Forbidden: you do not have permission to propose website publications.");
    }
    validatePath(data.path);

    const token = getRuntimeSecret("GITHUB_TOKEN");
    if (!token) {
      throw new Error("Website publishing is not configured yet. Add GITHUB_TOKEN as a server-side Cloudflare Worker secret with Contents and Pull requests write access to Nisla1234/ryzite-unified-platform.");
    }

    const encodedPath = data.path.split("/").map(encodeURIComponent).join("/");
    const baseRef = await githubRequest(token, `/repos/${REPOSITORY}/git/ref/heads/main`);
    const baseSha = baseRef.object?.sha;
    if (!baseSha) throw new Error("Could not resolve the website main branch commit.");

    const branch = `control-centre/content-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`;
    await githubRequest(token, `/repos/${REPOSITORY}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
    });

    try {
      const current = await githubRequest(
        token,
        `/repos/${REPOSITORY}/contents/${encodedPath}?ref=main`,
      );
      if (current.type !== "file" || !current.sha) {
        throw new Error("The selected path is not an existing file. Creating new website files is disabled in this editor.");
      }

      await githubRequest(token, `/repos/${REPOSITORY}/contents/${encodedPath}`, {
        method: "PUT",
        body: JSON.stringify({
          message: `content: ${data.title}`,
          content: toBase64Utf8(data.content),
          sha: current.sha,
          branch,
        }),
      });

      const pull = await githubRequest(token, `/repos/${REPOSITORY}/pulls`, {
        method: "POST",
        body: JSON.stringify({
          title: data.title,
          head: branch,
          base: "main",
          draft: true,
          body: [
            "## Proposed from RYZITE Control Centre",
            "",
            `- File: \`${data.path}\``,
            "- This is a draft pull request. No production files were changed.",
            "- Review the diff and run the website checks before merging.",
            "- The existing Cloudflare deployment pipeline remains responsible for production deployment.",
          ].join("\n"),
        }),
      });

      return {
        branch,
        pullRequestUrl: pull.html_url ?? null,
        pullRequestNumber: pull.number ?? null,
        message: "Draft pull request created. The live website has not changed; review and merge the PR to publish.",
      };
    } catch (error) {
      // Keep the branch for diagnosis/recovery; never force-push or modify main.
      throw error;
    }
  });
