import { createServerFn } from "@tanstack/react-start";
import { requireAdminAuth } from "./auth-middleware";
import { can } from "./permissions";

const LIVE_SITE_URL = "https://ryzite-unified-platform.ryziteonline.workers.dev/";
const GITHUB_TREE_URL = "https://api.github.com/repos/Nisla1234/ryzite-unified-platform/git/trees/main?recursive=1";

type GitTreeItem = { path: string; type: string; size?: number; sha: string };
type GitTreeResponse = { tree?: GitTreeItem[]; truncated?: boolean };

function mediaKind(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "ico"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "m4v"].includes(ext)) return "video";
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"].includes(ext)) return "document";
  return "other";
}

/** Read-only inventory of the exact public media files currently tracked by the live website repository. */
export const listLiveWebsiteMedia = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    if (!can(context.roles, "media.manage")) {
      throw new Error("Forbidden: Media management permission is required.");
    }

    const response = await fetch(GITHUB_TREE_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "RYZITE-Control-Centre/1.0",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      throw new Error(`Unable to read the live website media inventory (GitHub HTTP ${response.status}).`);
    }

    const body = (await response.json()) as GitTreeResponse;
    if (!Array.isArray(body.tree)) throw new Error("The live website returned an invalid media inventory.");

    const files = body.tree
      .filter((item) => item.type === "blob" && (
        item.path.startsWith("public/images/") ||
        item.path.startsWith("public/assets/") ||
        item.path === "public/Original Logo.png"
      ))
      .map((item) => {
        const publicPath = item.path.replace(/^public\//, "");
        const url = LIVE_SITE_URL + publicPath.split("/").map(encodeURIComponent).join("/");
        const name = item.path.split("/").pop() ?? item.path;
        const folder = item.path.includes("/") ? item.path.split("/").slice(1, -1).join("/") || "Root" : "Root";
        return {
          id: item.sha,
          name,
          path: item.path,
          folder,
          url,
          kind: mediaKind(item.path),
          size: item.size ?? 0,
          extension: name.includes(".") ? name.split(".").pop()?.toUpperCase() ?? "FILE" : "FILE",
        };
      })
      .sort((a, b) => a.path.localeCompare(b.path));

    return {
      files,
      count: files.length,
      truncated: Boolean(body.truncated),
      source: "Nisla1234/ryzite-unified-platform",
      branch: "main",
      checkedAt: new Date().toISOString(),
    };
  });
