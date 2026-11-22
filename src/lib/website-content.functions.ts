import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "./auth-middleware";
import { can, type Role } from "./permissions";
import { getRuntimeSecret } from "./runtime-env.server";

const REPOSITORY = "Nisla1234/ryzite-unified-platform";
const BRANCH = "main";
const API = "https://api.github.com";
const MAX_FILE_BYTES = 512 * 1024;

function githubHeaders() {
  const token = getRuntimeSecret("GITHUB_TOKEN");
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "RYZITE-Control-Centre/1.0",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function githubGet(url: string) {
  const response = await fetch(url, {
    headers: githubHeaders(),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "The website repository or requested file was not found."
        : `GitHub API request failed (HTTP ${response.status}).`,
    );
  }
  return response;
}

function assertContentPermission(roles: Role[]) {
  if (!can(roles, "content.edit")) {
    throw new Error("Forbidden: website content access is not permitted for this account.");
  }
}

export const getWebsiteContentIndex = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    assertContentPermission(context.roles);
    const response = await githubGet(
      `${API}/repos/${REPOSITORY}/git/trees/${BRANCH}?recursive=1`,
    );
    const body = (await response.json()) as {
      truncated?: boolean;
      tree?: Array<{ path: string; type: string; size?: number; sha: string }>;
    };
    const entries = (body.tree ?? []).filter((entry) => {
      if (entry.type !== "blob") return false;
      if (entry.path.startsWith("src/data/")) {
        return /\.(ts|tsx|js|json|md)$/i.test(entry.path) && !/\.(test|spec)\./i.test(entry.path);
      }
      if (entry.path.startsWith("public/assets/")) {
        return /\.(png|jpe?g|webp|avif|svg|gif|mp4|webm)$/i.test(entry.path);
      }
      return false;
    });
    return {
      repository: REPOSITORY,
      branch: BRANCH,
      truncated: body.truncated === true,
      contentFiles: entries
        .filter((entry) => entry.path.startsWith("src/data/"))
        .map(({ path, size, sha }) => ({ path, size: size ?? 0, sha })),
      mediaFiles: entries
        .filter((entry) => entry.path.startsWith("public/assets/"))
        .map(({ path, size, sha }) => ({ path, size: size ?? 0, sha })),
      checkedAt: new Date().toISOString(),
    };
  });

export const getWebsiteContentFile = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .inputValidator((input: unknown) =>
    z.object({ path: z.string().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertContentPermission(context.roles);
    if (
      !data.path.startsWith("src/data/") ||
      data.path.split("/").some((part) => part === ".." || part === "") ||
      !/\.(ts|tsx|js|json|md)$/i.test(data.path)
    ) {
      throw new Error("Only website content source files can be opened here.");
    }
    const urlPath = data.path.split("/").map(encodeURIComponent).join("/");
    const response = await githubGet(
      `${API}/repos/${REPOSITORY}/contents/${urlPath}?ref=${BRANCH}`,
    );
    const file = (await response.json()) as {
      type?: string;
      size?: number;
      encoding?: string;
      content?: string;
      sha?: string;
      path?: string;
    };
    if (file.type !== "file" || (file.size ?? 0) > MAX_FILE_BYTES || !file.content) {
      throw new Error("This file is not a supported text content file or exceeds the 512 KB preview limit.");
    }
    const binary = atob(file.content.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const text = new TextDecoder("utf-8").decode(bytes);
    return {
      path: file.path ?? data.path,
      sha: file.sha ?? "",
      size: file.size ?? bytes.byteLength,
      content: text,
      branch: BRANCH,
      readOnly: true as const,
    };
  });
