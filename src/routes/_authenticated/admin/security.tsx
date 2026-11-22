import { createFileRoute, redirect } from "@tanstack/react-router";

// Kept so old bookmarks still work: the security log now lives in the combined logs screen.
export const Route = createFileRoute("/_authenticated/admin/security")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/logs", search: { tab: "security" }, replace: true });
  },
});
